import { Project } from "@/models/Project";
import { Site } from "@/models/Site";
import { Expense } from "@/models/Expense";
import { dateMatch, idMatch, type ReportScope } from "@/lib/reports/scope";

export interface ExpenseSlice {
  label: string;
  amount: number;
  /** Share of the scoped total (0–100). */
  share: number;
}

export interface ExpenseAnalysis {
  total: number;
  byCategory: ExpenseSlice[];
  byProject: ExpenseSlice[];
  /** Only expenses with site attribution — unlabelled remainder stays in total. */
  bySite: ExpenseSlice[];
  monthly: { month: string; amount: number }[];
}

function withShare(rows: Array<{ label: string; amount: number }>, total: number): ExpenseSlice[] {
  return rows.map((r) => ({
    ...r,
    share: total > 0 ? Math.round((r.amount / total) * 1000) / 10 : 0,
  }));
}

/**
 * Expense Analysis — manual expenses only (purchases/salary are separate cost
 * heads, never double-counted). Filter-aware: category, project, site slices
 * all respect the same scope.
 */
export async function getExpenseAnalysis(
  scope?: ReportScope & { category?: string },
): Promise<ExpenseAnalysis> {
  const match = {
    ...dateMatch(scope),
    ...idMatch("project", scope?.projectId),
    ...idMatch("site", scope?.siteId),
    ...(scope?.category ? { category: scope.category } : {}),
  };
  const [byCategoryRows, byProjectRows, bySiteRows, monthlyRows, totalAgg] = await Promise.all([
    Expense.aggregate([
      { $match: match },
      { $group: { _id: "$category", amount: { $sum: "$amount" } } },
      { $sort: { amount: -1 } },
    ]),
    Expense.aggregate([
      { $match: match },
      {
        $lookup: {
          from: Project.collection.name,
          localField: "project",
          foreignField: "_id",
          as: "proj",
        },
      },
      { $unwind: { path: "$proj", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ["$proj.name", "General"] },
          amount: { $sum: "$amount" },
        },
      },
      { $sort: { amount: -1 } },
    ]),
    Expense.aggregate([
      { $match: { ...match, site: { $ne: null } } },
      {
        $lookup: { from: Site.collection.name, localField: "site", foreignField: "_id", as: "s" },
      },
      { $unwind: { path: "$s", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ["$s.name", "—"] },
          amount: { $sum: "$amount" },
        },
      },
      { $sort: { amount: -1 } },
    ]),
    Expense.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
          amount: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Expense.aggregate([
      { $match: match },
      { $group: { _id: null, amount: { $sum: "$amount" } } },
    ]),
  ]);
  const total = totalAgg[0]?.amount ?? 0;
  return {
    total,
    byCategory: withShare(
      (byCategoryRows as Array<{ _id: string; amount: number }>).map((r) => ({
        label: r._id,
        amount: r.amount,
      })),
      total,
    ),
    byProject: withShare(
      (byProjectRows as Array<{ _id: string; amount: number }>).map((r) => ({
        label: r._id,
        amount: r.amount,
      })),
      total,
    ),
    bySite: withShare(
      (bySiteRows as Array<{ _id: string; amount: number }>).map((r) => ({
        label: r._id,
        amount: r.amount,
      })),
      total,
    ),
    monthly: (monthlyRows as Array<{ _id: string; amount: number }>).map((m) => ({
      month: m._id,
      amount: m.amount,
    })),
  };
}
