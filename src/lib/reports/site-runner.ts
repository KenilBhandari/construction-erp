import { Site } from "@/models/Site";
import { Attendance } from "@/models/Attendance";
import { Overtime } from "@/models/Overtime";
import { StockTransaction } from "@/models/StockTransaction";
import { Expense } from "@/models/Expense";
import { dateMatch, idMatch, type ReportScope } from "@/lib/reports/scope";
import { getMonthlyCostTrend } from "@/lib/reports/project-runner";
import { getAttendanceAnalysis } from "@/lib/reports/labour";
import { getMaterialMovement } from "@/lib/reports/material";
import { getExpenseRecords, type ExpenseRecord } from "@/lib/reports/records";
import { REPORT_PAGE_SIZE } from "@/lib/reports/project-runner";
import type { CostTrendMonth } from "@/lib/reports/project-runner";

export interface SiteReport {
  header: { siteId: string; name: string; projectId: string; projectName: string };
  totals: { total: number; labour: number; materials: number; expenses: number };
  labourByWorker: Array<{
    labourId: string;
    name: string;
    present: number;
    half: number;
    absent: number;
    otHours: number;
  }>;
  materialsByMaterial: Array<{ materialId: string; name: string; purchased: number; consumed: number }>;
  expenseHistory: { rows: ExpenseRecord[]; total: number };
  trend: CostTrendMonth[];
  generatedAt: Date;
}

/** Site runner — investigate why a site cost what it cost. One service for screen + PDF. */
export async function getSiteReport(
  scope: Pick<ReportScope, "from" | "to" | "siteId"> & { page?: number; pageSize?: number },
): Promise<SiteReport> {
  if (!scope.siteId) throw new Error("Site is required for this report.");
  const site = await Site.findById(scope.siteId).populate("project", "name").lean();
  if (!site) throw new Error("Site not found.");
  const dm = dateMatch(scope);
  const sm = idMatch("site", scope.siteId);
  const proj = site.project as unknown as { _id?: unknown; name?: string } | null;

  const [attendanceAgg, overtimeAgg, purchaseAgg, expenseAgg, labourByWorker, materials, expenseHistory, trend] =
    await Promise.all([
      Attendance.aggregate([
        { $match: { ...dm, ...sm } },
        { $group: { _id: null, cost: { $sum: { $ifNull: ["$cost", 0] } } } },
      ]),
      Overtime.aggregate([
        { $match: { ...dm, ...sm } },
        { $group: { _id: null, amount: { $sum: "$amount" } } },
      ]),
      StockTransaction.aggregate([
        { $match: { ...dm, ...sm, type: "purchase" } },
        { $group: { _id: null, amount: { $sum: "$total" } } },
      ]),
      Expense.aggregate([
        { $match: { ...dm, ...sm } },
        { $group: { _id: null, amount: { $sum: "$amount" } } },
      ]),
      getAttendanceAnalysis({ from: scope.from, to: scope.to, siteId: scope.siteId }),
      getMaterialMovement({ from: scope.from, to: scope.to, siteId: scope.siteId }),
      getExpenseRecords(
        { from: scope.from, to: scope.to, siteId: scope.siteId },
        scope.page ?? 1,
        scope.pageSize ?? REPORT_PAGE_SIZE,
      ),
      getMonthlyCostTrend({ from: scope.from, to: scope.to, siteId: scope.siteId }),
    ]);

  const labour = Math.round(attendanceAgg[0]?.cost ?? 0) + (overtimeAgg[0]?.amount ?? 0);
  const materialsCost = purchaseAgg[0]?.amount ?? 0;
  const expensesCost = expenseAgg[0]?.amount ?? 0;

  return {
    header: {
      siteId: scope.siteId,
      name: site.name as string,
      projectId: String(proj && typeof proj === "object" && "_id" in proj ? proj._id : ""),
      projectName: proj && typeof proj === "object" && "name" in proj ? String(proj.name) : "—",
    },
    totals: { total: labour + materialsCost + expensesCost, labour, materials: materialsCost, expenses: expensesCost },
    labourByWorker: labourByWorker.map((w) => ({
      labourId: w.labourId,
      name: w.name,
      present: w.present,
      half: w.half,
      absent: w.absent,
      otHours: w.otHours,
    })),
    materialsByMaterial: materials.map((m) => ({
      materialId: m.materialId,
      name: m.name,
      purchased: m.purchased,
      consumed: m.consumed,
    })),
    expenseHistory,
    trend,
    generatedAt: new Date(),
  };
}
