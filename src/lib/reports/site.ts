import { Types } from "mongoose";
import { Site } from "@/models/Site";
import { StockTransaction } from "@/models/StockTransaction";
import { Attendance } from "@/models/Attendance";
import { Overtime } from "@/models/Overtime";
import { Expense } from "@/models/Expense";
import { dateMatch, idMatch, type ReportScope } from "@/lib/reports/scope";

export interface SitePerformanceRow {
  _id: string;
  name: string;
  projectId: string;
  projectName: string;
  /** Attendance snapshot cost + Overtime amounts (canonical labour rule). */
  labourCost: number;
  /** Purchase totals attributed to the site. */
  materialCost: number;
  manualExpenses: number;
  totalCost: number;
}

/**
 * Site Performance — connects Projects → Sites → Labour → Materials → Expenses.
 * Labour cost aggregates Attendance/Overtime directly (never Salary.site).
 */
export async function getSitePerformance(scope?: ReportScope): Promise<SitePerformanceRow[]> {
  const sites = await Site.find({
    ...idMatch("_id", scope?.siteId),
    ...idMatch("project", scope?.projectId),
  })
    .populate("project", "name")
    .sort({ name: 1 })
    .lean();
  const dm = dateMatch(scope);
  return Promise.all(
    sites.map(async (s) => {
      const sid = s._id as Types.ObjectId;
      const [attendanceAgg, overtimeAgg, purchaseAgg, expenseAgg] = await Promise.all([
        Attendance.aggregate([
          { $match: { site: sid, ...dm } },
          { $group: { _id: null, cost: { $sum: { $ifNull: ["$cost", 0] } } } },
        ]),
        Overtime.aggregate([
          { $match: { site: sid, ...dm } },
          { $group: { _id: null, amount: { $sum: "$amount" } } },
        ]),
        StockTransaction.aggregate([
          { $match: { site: sid, type: "purchase", ...dm } },
          { $group: { _id: null, amount: { $sum: "$total" } } },
        ]),
        Expense.aggregate([
          { $match: { site: sid, ...dm } },
          { $group: { _id: null, amount: { $sum: "$amount" } } },
        ]),
      ]);
      const labourCost =
        Math.round(attendanceAgg[0]?.cost ?? 0) + (overtimeAgg[0]?.amount ?? 0);
      const materialCost = purchaseAgg[0]?.amount ?? 0;
      const manualExpenses = expenseAgg[0]?.amount ?? 0;
      const proj = s.project as unknown as { _id?: Types.ObjectId; name?: string } | Types.ObjectId | null;
      return {
        _id: String(s._id),
        name: s.name as string,
        projectId: String(
          proj && typeof proj === "object" && "_id" in proj ? (proj._id as Types.ObjectId) : (proj as Types.ObjectId | null),
        ),
        projectName:
          proj && typeof proj === "object" && "name" in proj ? String(proj.name) : "—",
        labourCost,
        materialCost,
        manualExpenses,
        totalCost: labourCost + materialCost + manualExpenses,
      };
    }),
  );
}
