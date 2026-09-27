import { Project } from "@/models/Project";
import { StockTransaction } from "@/models/StockTransaction";
import { Attendance } from "@/models/Attendance";
import { Overtime } from "@/models/Overtime";
import { Expense } from "@/models/Expense";
import { ClientPayment } from "@/models/ClientPayment";
import { getProjectFinance, type FinanceScope } from "@/lib/finance";
import { calculatePendingPayment } from "@/lib/calculations";
import { dateMatch, idMatch, type ReportScope } from "@/lib/reports/scope";
import type { ProjectFinance } from "@/types/finance";

export interface ProjectPerformanceRow extends ProjectFinance {
  _id: string;
  name: string;
  clientName: string;
  status: string;
}

/**
 * Project Performance — upgrades the legacy Project Financials section.
 * Consumes canonical getProjectFinance per project (margin included).
 * Pass date/site scope for period P&L; omit for lifetime (legacy numbers).
 */
export async function getProjectPerformance(scope?: ReportScope): Promise<ProjectPerformanceRow[]> {
  const projects = await Project.find({ ...idMatch("_id", scope?.projectId) })
    .sort({ updatedAt: -1 })
    .lean();
  const financeScope: FinanceScope | undefined = scope?.from || scope?.to || scope?.siteId
    ? { from: scope.from, to: scope.to, site: scope.siteId }
    : undefined;
  return Promise.all(
    projects.map(async (p) => {
      const f = await getProjectFinance(String(p._id), financeScope);
      return {
        _id: String(p._id),
        name: p.name as string,
        clientName: p.clientName as string,
        status: p.status as string,
        ...f,
      };
    }),
  );
}

export interface ReceivableRow {
  _id: string;
  name: string;
  clientName: string;
  contractValue: number;
  received: number;
  /** Contract Value − Recorded Client Payments. No aging — no due-date field exists. */
  outstanding: number;
}

/** Client Receivables — per project, scoped by date. Payment history stays on row click (UI). */
export async function getReceivables(scope?: Pick<ReportScope, "from" | "to" | "projectId">): Promise<ReceivableRow[]> {
  const projects = await Project.find({ ...idMatch("_id", scope?.projectId) })
    .sort({ updatedAt: -1 })
    .select("name clientName contractValue")
    .lean();
  const dm = dateMatch(scope);
  return Promise.all(
    projects.map(async (p) => {
      const agg = await ClientPayment.aggregate([
        { $match: { project: p._id, ...dm } },
        { $group: { _id: null, amount: { $sum: "$amount" } } },
      ]);
      const received = agg[0]?.amount ?? 0;
      return {
        _id: String(p._id),
        name: p.name as string,
        clientName: p.clientName as string,
        contractValue: p.contractValue as number,
        received,
        outstanding: calculatePendingPayment(p.contractValue as number, received),
      };
    }),
  );
}

export interface UnattributedCosts {
  materialPurchases: number;
  labourCost: number;
  manualExpenses: number;
  total: number;
}

/**
 * General / Unassigned bucket — records with null project, same canonical
 * formula as getProjectFinance. Invariant: global = Σ projects + General.
 */
export async function getUnattributedCosts(scope?: Pick<ReportScope, "from" | "to">): Promise<UnattributedCosts> {
  const dm = dateMatch(scope);
  const [purchaseAgg, attendanceAgg, overtimeAgg, expenseAgg] = await Promise.all([
    StockTransaction.aggregate([
      { $match: { project: null, type: "purchase", ...dm } },
      { $group: { _id: null, amount: { $sum: "$total" } } },
    ]),
    Attendance.aggregate([
      { $match: { project: null, ...dm } },
      { $group: { _id: null, cost: { $sum: { $ifNull: ["$cost", 0] } } } },
    ]),
    Overtime.aggregate([
      { $match: { project: null, ...dm } },
      { $group: { _id: null, amount: { $sum: "$amount" } } },
    ]),
    Expense.aggregate([
      {
        $match: {
          $or: [{ project: null }, { project: { $exists: false } }],
          ...dm,
        },
      },
      { $group: { _id: null, amount: { $sum: "$amount" } } },
    ]),
  ]);
  const materialPurchases = purchaseAgg[0]?.amount ?? 0;
  const labourCost =
    Math.round(attendanceAgg[0]?.cost ?? 0) + (overtimeAgg[0]?.amount ?? 0);
  const manualExpenses = expenseAgg[0]?.amount ?? 0;
  return { materialPurchases, labourCost, manualExpenses, total: materialPurchases + labourCost + manualExpenses };
}
