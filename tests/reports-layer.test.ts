import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Project } from "@/models/Project";
import { Site } from "@/models/Site";
import { Labour } from "@/models/Labour";
import { Attendance } from "@/models/Attendance";
import { Overtime } from "@/models/Overtime";
import { Material } from "@/models/Material";
import { StockTransaction } from "@/models/StockTransaction";
import { Expense } from "@/models/Expense";
import { ClientPayment } from "@/models/ClientPayment";
import { SalaryPayment } from "@/models/SalaryPayment";
import { LabourAdvance } from "@/models/LabourAdvance";
import { toDayDate } from "@/lib/utils";
import { getProjectFinance } from "@/lib/finance";
import {
  getProjectPerformance,
  getReceivables,
  getUnattributedCosts,
  getSitePerformance,
  getAttendanceAnalysis,
  getSiteLabourCost,
  getOvertimeReport,
  getMaterialMovement,
  getStockValuation,
  getPurchaseConsumption,
  getCashFlow,
  getExpenseAnalysis,
  getAdvanceReport,
  getSalaryAnalysis,
  scopeLabel,
  getMonthlyCostTrend,
  getPaymentRecords,
  getProjectReport,
  getSiteReport,
  getLabourReportDetail,
  getAttendanceRecords,
  getExpenseRecords,
  getStockRecords,
  getOvertimeRecords,
  getMaterialReport,
  getExpenseRunnerReport,
  getPaymentRunnerReport,
} from "@/lib/reports";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Promise.all(
    [
      Project, Site, Labour, Attendance, Overtime, Material, StockTransaction,
      Expense, ClientPayment, SalaryPayment, LabourAdvance,
    ].map((m) => m.deleteMany({})),
  );
});

async function seed() {
  const project = await Project.create({
    name: "P1", clientName: "C1", location: "L", budget: 100000,
    contractValue: 100000, status: "active",
  });
  const site = await Site.create({ name: "S1", project: project._id, status: "active" });
  const labour = await Labour.create({
    name: "Ramesh", phone: "9999999999", skill: "Mason",
    dailyRate: 600, hourlyRate: 100, status: "active",
  });
  const material = await Material.create({
    name: "Cement", category: "Raw", unit: "Bag",
    currentStock: 70, minimumStock: 10, defaultPurchaseRate: 350,
  });
  await Attendance.create({
    labour: labour._id, site: site._id, project: project._id,
    date: toDayDate("2026-09-10"), status: "present",
    dailyRateSnapshot: 600, hourlyRateSnapshot: 100, cost: 600,
  });
  await Overtime.create({
    labour: labour._id, site: site._id, project: project._id,
    date: toDayDate("2026-09-10"), hours: 2, rate: 100, amount: 200,
  });
  await StockTransaction.create({
    material: material._id, project: project._id, site: site._id,
    date: toDayDate("2026-09-05"), type: "purchase",
    quantity: 100, rate: 350, total: 35000,
  });
  await StockTransaction.create({
    material: material._id, project: project._id, site: site._id,
    date: toDayDate("2026-09-12"), type: "consumption",
    quantity: 30, rate: 350, total: 10500,
  });
  await Expense.create({
    project: project._id, site: site._id, date: toDayDate("2026-09-11"),
    category: "Transport", description: "Truck", amount: 2000, paymentMethod: "Cash",
  });
  await ClientPayment.create({
    project: project._id, date: toDayDate("2026-09-15"), amount: 40000, paymentMethod: "Cash",
  });
  await LabourAdvance.create({
    labour: labour._id, date: toDayDate("2026-09-08"), amount: 5000, paymentMethod: "Cash",
  });
  return { project, site, labour, material };
}

describe("reports layer — canonical consumption + locked rules", () => {
  it("scoped getProjectFinance matches unscoped lifetime totals", async () => {
    const { project } = await seed();
    const id = String(project._id);
    const full = await getProjectFinance(id);
    const scoped = await getProjectFinance(id, { from: "2026-09-01", to: "2026-09-30" });
    expect(scoped.totalExpense).toBe(full.totalExpense);
    expect(scoped.received).toBe(full.received);
    expect(full.totalExpense).toBe(35000 + 600 + 200 + 2000);
    expect(full.labourExpense).toBe(800); // Attendance.cost + Overtime.amount
    expect(full.pending).toBe(60000);
  });

  it("to-date is inclusive through 23:59:59 — Sep 27 records included", async () => {
    const { project } = await seed();
    await Expense.create({
      project: project._id, date: toDayDate("2026-09-27"),
      category: "Other", description: "Late", amount: 500, paymentMethod: "Cash",
    });
    const scoped = await getProjectFinance(String(project._id), { from: "2026-09-27", to: "2026-09-27" });
    expect(scoped.manualExpenses).toBe(500);
  });

  it("global = Σ projects + General bucket", async () => {
    const { project } = await seed();
    await Expense.create({
      project: null, date: toDayDate("2026-09-11"),
      category: "Other", description: "General", amount: 1000, paymentMethod: "Cash",
    });
    const [perf, general] = await Promise.all([getProjectPerformance(), getUnattributedCosts()]);
    const namedTotal = perf.reduce((s, p) => s + p.totalExpense, 0);
    expect(namedTotal + general.total).toBe(35000 + 600 + 200 + 2000 + 1000);
    expect(general.manualExpenses).toBe(1000);
  });

  it("site performance + site labour cost with Unassigned bucket", async () => {
    const { site } = await seed();
    const sites = await getSitePerformance();
    expect(sites).toHaveLength(1);
    expect(sites[0].name).toBe("S1");
    expect(sites[0].projectName).toBe("P1");
    expect(sites[0].labourCost).toBe(800);
    expect(sites[0].materialCost).toBe(35000);
    expect(sites[0].totalCost).toBe(800 + 35000 + 2000);
    const labour = await getSiteLabourCost();
    expect(labour.find((r) => r.siteId === String(site._id))?.total).toBe(800);
  });

  it("attendance analysis + overtime reconciliation surface drift honestly", async () => {
    await seed();
    const att = await getAttendanceAnalysis();
    expect(att[0].present).toBe(1);
    expect(att[0].name).toBe("Ramesh");
    const ot = await getOvertimeReport();
    expect(ot.totalCost).toBe(200);
    // No salary settlement exists → salary side is 0, drift = full 200. Honest, not hidden.
    expect(ot.reconciliation.overtimeRecords).toBe(200);
    expect(ot.reconciliation.salaryRecords).toBe(0);
    expect(ot.reconciliation.drift).toBe(200);
  });

  it("material movement, valuation source, and conditional variance", async () => {
    await seed();
    const [movement, valuation, recon] = await Promise.all([
      getMaterialMovement(),
      getStockValuation(),
      getPurchaseConsumption(),
    ]);
    expect(movement[0].purchased).toBe(100);
    expect(movement[0].consumed).toBe(30);
    expect(valuation[0].rateSource).toBe("default-rate");
    expect(valuation[0].estimatedValue).toBe(70 * 350);
    // Unscoped → variance allowed: 70 actual vs 100−30 expected = 0.
    expect(recon[0].variance).toBe(0);
    const scopedRecon = await getPurchaseConsumption({ projectId: String((await Project.findOne().lean())!._id) });
    // Scoped → variance null, never manufactured.
    expect(scopedRecon[0].variance).toBeNull();
  });

  it("cash flow splits outflow heads; receivables carry no aging", async () => {
    await seed();
    const flow = await getCashFlow({ from: "2026-09-01", to: "2026-09-30" });
    const sep = flow.find((m) => m.month.includes("Sep"));
    expect(sep?.inflow).toBe(40000);
    expect(sep?.purchaseOutflow).toBe(35000);
    expect(sep?.expenseOutflow).toBe(2000);
    expect(sep?.net).toBe(40000 - 35000 - 2000);
    const recv = await getReceivables();
    expect(recv[0].outstanding).toBe(60000);
    expect(recv[0]).not.toHaveProperty("overdue");
  });

  it("expense analysis shares sum to total; advance lifetime outstanding", async () => {
    await seed();
    const analysis = await getExpenseAnalysis();
    expect(analysis.total).toBe(2000);
    expect(analysis.byCategory[0].share).toBe(100);
    expect(analysis.bySite[0].label).toBe("S1");
    const advances = await getAdvanceReport();
    expect(advances.rows[0].outstanding).toBe(5000);
    expect(advances.totals.outstanding).toBe(5000);
    const salary = await getSalaryAnalysis();
    expect(salary).toHaveLength(0); // no settlements — empty, not zeroes
  });

  it("scopeLabel renders the active population", () => {
    expect(scopeLabel({ project: "P1", site: "S1", from: "2026-09-01", to: "2026-09-27" }))
      .toContain("P1 · S1 · ");
  });

  it("monthly cost trend splits heads and zero-fills scoped months", async () => {
    await seed();
    const trend = await getMonthlyCostTrend({ from: "2026-09-01", to: "2026-09-30" });
    expect(trend).toHaveLength(1);
    expect(trend[0].labour).toBe(800); // 600 attendance + 200 overtime
    expect(trend[0].materials).toBe(35000);
    expect(trend[0].expenses).toBe(2000);
    expect(trend[0].total).toBe(800 + 35000 + 2000);
    const wide = await getMonthlyCostTrend({ from: "2026-08-01", to: "2026-09-30" });
    expect(wide).toHaveLength(2);
    expect(wide[0].total).toBe(0); // August zero-filled, not dropped
  });

  it("project runner composes summary + breakdown + trend + sites + payments", async () => {
    const { project } = await seed();
    const report = await getProjectReport({ projectId: String(project._id) });
    expect(report.header.name).toBe("P1");
    expect(report.summary.cost).toBe(35000 + 600 + 200 + 2000);
    expect(report.summary.received).toBe(40000);
    expect(report.summary.outstanding).toBe(60000);
    expect(report.costBreakdown).toMatchObject({ labour: 600, materials: 35000, overtime: 200, expenses: 2000 });
    expect(report.siteBreakdown).toHaveLength(1);
    expect(report.siteBreakdown[0].totalCost).toBe(600 + 200 + 35000 + 2000);
    expect(report.payments.total).toBe(1);
    expect(report.trend.length).toBeGreaterThan(0);
    // Scoped runner matches scoped canonical finance.
    const scoped = await getProjectReport({ projectId: String(project._id), from: "2026-09-01", to: "2026-09-30" });
    expect(scoped.summary.cost).toBe(report.summary.cost);
  });

  it("site runner totals + worker/material/expense detail", async () => {
    const { site } = await seed();
    const report = await getSiteReport({ siteId: String(site._id) });
    expect(report.header.projectName).toBe("P1");
    expect(report.totals).toMatchObject({ labour: 800, materials: 35000, expenses: 2000 });
    expect(report.totals.total).toBe(800 + 35000 + 2000);
    expect(report.labourByWorker[0]).toMatchObject({ name: "Ramesh", present: 1 });
    expect(report.materialsByMaterial[0]).toMatchObject({ purchased: 100, consumed: 30 });
    expect(report.expenseHistory.total).toBe(1);
    expect(report.trend.length).toBeGreaterThan(0);
  });

  it("labour runner: earnings from records, salary paid/outstanding, advance position", async () => {
    const { labour } = await seed();
    const report = await getLabourReportDetail({ labourId: String(labour._id) });
    expect(report.header.skill).toBe("Mason");
    expect(report.attendance.present).toBe(1);
    expect(report.cost).toMatchObject({ earned: 600, overtime: 200, total: 800 });
    expect(report.salary).toMatchObject({ paid: 0, outstanding: 0 }); // no settlements
    expect(report.advanceOutstanding).toBe(5000);
    expect(report.history.total).toBe(1);
    expect(report.history.rows[0]).toMatchObject({ status: "present", siteName: "S1" });
  });

  it("material runner reconciles opening/flows/closing; scoped views show flows only", async () => {
    const { material } = await seed();
    const mid = String(material._id);
    const lifetime = await getMaterialReport({ materialId: mid });
    expect(lifetime.summary).toMatchObject({
      opening: 0,
      purchased: 100,
      consumed: 30,
      returned: 0,
      closing: 70,
      current: 70,
    });
    const sept = await getMaterialReport({ materialId: mid, from: "2026-09-01", to: "2026-09-30" });
    expect(sept.summary.opening).toBe(0); // 70 − (100 − 30)
    expect(sept.summary.closing).toBe(70); // nothing after Sep 30
    expect(sept.trend).toHaveLength(1);
    expect(sept.history.total).toBe(2);
    const pid = String((await Project.findOne().lean())!._id);
    const scoped = await getMaterialReport({ materialId: mid, projectId: pid });
    // Project-scoped: flows shown, balances never manufactured.
    expect(scoped.summary.purchased).toBe(100);
    expect(scoped.summary.opening).toBeNull();
    expect(scoped.summary.closing).toBeNull();
  });

  it("expense runner: summary + category shares + history", async () => {
    const { project } = await seed();
    const report = await getExpenseRunnerReport({ projectId: String(project._id) });
    expect(report.summary).toMatchObject({ total: 2000, count: 1 });
    expect(report.byCategory).toHaveLength(1);
    expect(report.byCategory[0]).toMatchObject({ label: "Transport", share: 100 });
    expect(report.trend).toHaveLength(1);
    expect(report.history.rows[0]).toMatchObject({ description: "Truck", siteName: "S1" });
  });

  it("payments runner: project trio, all-projects split, scoped honesty", async () => {
    const { project } = await seed();
    const pid = String(project._id);
    const one = await getPaymentRunnerReport({ projectId: pid });
    expect(one.header.projectName).toBe("P1");
    expect(one.summary).toMatchObject({ contract: 100000, received: 40000, outstanding: 60000, count: 1 });
    expect(one.history.rows[0].projectName).toBe("P1");
    // Date-scoped: received + count stand, lifetime figures go null.
    const scoped = await getPaymentRunnerReport({ projectId: pid, from: "2026-09-01", to: "2026-09-30" });
    expect(scoped.summary.received).toBe(40000);
    expect(scoped.summary.contract).toBeNull();
    expect(scoped.summary.outstanding).toBeNull();
    const all = await getPaymentRunnerReport({});
    expect(all.summary).toMatchObject({ contract: 100000, received: 40000, outstanding: 60000 });
    expect(all.byProject).toHaveLength(1);
  });

  it("record fetchers paginate (100/page) with totals", async () => {
    const { project } = await seed();
    const pid = String(project._id);
    const [att, exp, stock, ot, pay] = await Promise.all([
      getAttendanceRecords({ projectId: pid }),
      getExpenseRecords({ projectId: pid }),
      getStockRecords({ projectId: pid }),
      getOvertimeRecords({ projectId: pid }),
      getPaymentRecords({ projectId: pid }),
    ]);
    expect(att.total).toBe(1);
    expect(exp.rows[0].category).toBe("Transport");
    expect(stock.total).toBe(2);
    expect(ot.rows[0].cost).toBe(200);
    expect(pay.rows[0].amount).toBe(40000);
  });
});
