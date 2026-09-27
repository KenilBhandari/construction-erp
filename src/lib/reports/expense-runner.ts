import { Expense } from "@/models/Expense";
import { dateMatch, idMatch, type ReportScope } from "@/lib/reports/scope";
import { REPORT_PAGE_SIZE } from "@/lib/reports/project-runner";
import { getExpenseRecords, type ExpenseRecord } from "@/lib/reports/records";

export interface ExpenseRunnerReport {
  summary: { total: number; count: number };
  byCategory: Array<{ label: string; amount: number; share: number }>;
  trend: Array<{ month: string; amount: number }>;
  history: { rows: ExpenseRecord[]; total: number };
  generatedAt: Date;
}

/** Expenses runner — full transaction history with category + monthly analysis. */
export async function getExpenseRunnerReport(
  scope: Pick<ReportScope, "from" | "to" | "projectId" | "siteId"> & {
    category?: string;
    page?: number;
    pageSize?: number;
  },
): Promise<ExpenseRunnerReport> {
  const match = {
    ...dateMatch(scope),
    ...idMatch("project", scope?.projectId),
    ...idMatch("site", scope?.siteId),
    ...(scope?.category ? { category: scope.category } : {}),
  };
  const [byCategoryRows, trendRows, totalAgg, history] = await Promise.all([
    Expense.aggregate([
      { $match: match },
      { $group: { _id: "$category", amount: { $sum: "$amount" } } },
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
      { $group: { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    getExpenseRecords(scope, scope.page ?? 1, scope.pageSize ?? REPORT_PAGE_SIZE),
  ]);
  const total = totalAgg[0]?.amount ?? 0;
  return {
    summary: { total, count: totalAgg[0]?.count ?? 0 },
    byCategory: (byCategoryRows as Array<{ _id: string; amount: number }>).map((r) => ({
      label: r._id,
      amount: r.amount,
      share: total > 0 ? Math.round((r.amount / total) * 1000) / 10 : 0,
    })),
    trend: (trendRows as Array<{ _id: string; amount: number }>).map((m) => ({
      month: m._id,
      amount: m.amount,
    })),
    history,
    generatedAt: new Date(),
  };
}
