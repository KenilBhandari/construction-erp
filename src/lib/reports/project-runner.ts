import { Project } from "@/models/Project";
import { StockTransaction } from "@/models/StockTransaction";
import { Attendance } from "@/models/Attendance";
import { Overtime } from "@/models/Overtime";
import { Expense } from "@/models/Expense";
import { ClientPayment } from "@/models/ClientPayment";
import { getProjectFinance } from "@/lib/finance";
import { dateMatch, idMatch, type ReportScope } from "@/lib/reports/scope";
import { getSitePerformance } from "@/lib/reports/site";

export const REPORT_PAGE_SIZE = 100;

export interface CostTrendMonth {
  month: string;
  labour: number;
  materials: number;
  expenses: number;
  total: number;
}

/**
 * Monthly cost trend per head — labour (attendance + overtime), materials
 * (purchases), manual expenses. Buckets follow the scope range; months with
 * no activity are zero-filled so the trend tells the truth.
 */
export async function getMonthlyCostTrend(
  scope: Pick<ReportScope, "from" | "to" | "projectId" | "siteId">,
): Promise<CostTrendMonth[]> {
  const base = {
    ...dateMatch(scope),
    ...idMatch("project", scope?.projectId),
    ...idMatch("site", scope?.siteId),
  };
  const [attendanceRows, overtimeRows, purchaseRows, expenseRows] = await Promise.all([
    Attendance.aggregate([
      { $match: base },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
          amount: { $sum: { $ifNull: ["$cost", 0] } },
        },
      },
    ]),
    Overtime.aggregate([
      { $match: base },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
          amount: { $sum: "$amount" },
        },
      },
    ]),
    StockTransaction.aggregate([
      { $match: { ...base, type: "purchase" } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
          amount: { $sum: "$total" },
        },
      },
    ]),
    Expense.aggregate([
      { $match: base },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
          amount: { $sum: "$amount" },
        },
      },
    ]),
  ]);
  const labour = new Map<string, number>();
  const materials = new Map<string, number>();
  const expenses = new Map<string, number>();
  for (const r of attendanceRows as Array<{ _id: string; amount: number }>) {
    labour.set(r._id, Math.round(r.amount));
  }
  for (const r of overtimeRows as Array<{ _id: string; amount: number }>) {
    labour.set(r._id, (labour.get(r._id) ?? 0) + r.amount);
  }
  for (const r of purchaseRows as Array<{ _id: string; amount: number }>) {
    materials.set(r._id, Math.round(r.amount));
  }
  for (const r of expenseRows as Array<{ _id: string; amount: number }>) {
    expenses.set(r._id, Math.round(r.amount));
  }

  const keys: string[] = [];
  if (scope?.from || scope?.to) {
    const start = new Date(`${(scope.from ?? scope.to) as string}T00:00:00Z`);
    const end = new Date(`${(scope.to ?? scope.from) as string}T00:00:00Z`);
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    while (cursor <= last) {
      keys.push(cursor.toISOString().slice(0, 7));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }
  for (const k of new Set([...labour.keys(), ...materials.keys(), ...expenses.keys()])) {
    if (!keys.includes(k)) keys.push(k);
  }
  keys.sort();
  return keys.map((k) => {
    const l = labour.get(k) ?? 0;
    const m = materials.get(k) ?? 0;
    const e = expenses.get(k) ?? 0;
    return { month: k, labour: l, materials: m, expenses: e, total: l + m + e };
  });
}

export interface PaymentRecord {
  _id: string;
  date: Date;
  projectName: string;
  amount: number;
  paymentMethod: string;
  reference: string | null;
  notes: string | null;
}

/** Scoped client-payment history — server-paginated, 100/page (pageSize override for PDF). */
export async function getPaymentRecords(
  scope: Pick<ReportScope, "from" | "to" | "projectId">,
  page = 1,
  pageSize = REPORT_PAGE_SIZE,
): Promise<{ rows: PaymentRecord[]; total: number }> {
  const match = { ...dateMatch(scope), ...idMatch("project", scope?.projectId) };
  const [rows, total] = await Promise.all([
    ClientPayment.find(match)
      .populate("project", "name")
      .sort({ date: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    ClientPayment.countDocuments(match),
  ]);
  const nameOf = (ref: unknown): string =>
    ref && typeof ref === "object" && "name" in ref ? String((ref as { name: unknown }).name) : "—";
  return {
    rows: rows.map((p) => ({
      _id: String(p._id),
      date: p.date as Date,
      projectName: nameOf(p.project),
      amount: p.amount as number,
      paymentMethod: (p.paymentMethod as string) ?? "Cash",
      reference: (p.reference as string | null) ?? null,
      notes: (p.notes as string | null) ?? null,
    })),
    total,
  };
}

export interface ProjectReport {
  header: {
    projectId: string;
    name: string;
    clientName: string;
    status: string;
    contractValue: number;
    startDate: Date | null;
  };
  summary: {
    contract: number;
    cost: number;
    received: number;
    outstanding: number;
    profit: number;
    margin: number;
  };
  costBreakdown: { labour: number; materials: number; overtime: number; expenses: number };
  trend: CostTrendMonth[];
  siteBreakdown: Array<{ siteId: string; name: string; totalCost: number }>;
  payments: { rows: PaymentRecord[]; total: number };
  generatedAt: Date;
}

/**
 * Project Financials runner — one service for screen + PDF.
 * Scope dates come from presets or custom range (dayRange-inclusive).
 */
export async function getProjectReport(
  scope: Pick<ReportScope, "from" | "to" | "projectId" | "siteId"> & { page?: number; pageSize?: number },
): Promise<ProjectReport> {
  if (!scope.projectId) throw new Error("Project is required for this report.");
  const project = await Project.findById(scope.projectId).lean();
  if (!project) throw new Error("Project not found.");
  const financeScope =
    scope.from || scope.to || scope.siteId
      ? { from: scope.from, to: scope.to, site: scope.siteId }
      : undefined;
  const [finance, trend, sites, payments] = await Promise.all([
    getProjectFinance(scope.projectId, financeScope),
    getMonthlyCostTrend(scope),
    getSitePerformance({ projectId: scope.projectId, from: scope.from, to: scope.to }),
    getPaymentRecords(scope, scope.page ?? 1, scope.pageSize ?? REPORT_PAGE_SIZE),
  ]);
  return {
    header: {
      projectId: scope.projectId,
      name: project.name as string,
      clientName: project.clientName as string,
      status: project.status as string,
      contractValue: project.contractValue as number,
      startDate: (project.startDate as Date | undefined) ?? null,
    },
    summary: {
      contract: finance.contractValue,
      cost: finance.totalExpense,
      received: finance.received,
      outstanding: finance.pending,
      profit: finance.profit,
      margin: finance.margin,
    },
    costBreakdown: {
      labour: finance.labourBreakdown.attendanceCost,
      materials: finance.materialExpense,
      overtime: finance.labourBreakdown.overtimeRecords,
      expenses: finance.manualExpenses,
    },
    trend,
    siteBreakdown: sites.map((s) => ({ siteId: s._id, name: s.name, totalCost: s.totalCost })),
    payments,
    generatedAt: new Date(),
  };
}
