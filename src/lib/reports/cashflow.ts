import { ClientPayment } from "@/models/ClientPayment";
import { SalaryPayment } from "@/models/SalaryPayment";
import { StockTransaction } from "@/models/StockTransaction";
import { Expense } from "@/models/Expense";
import { dateMatch, idMatch, type ReportScope } from "@/lib/reports/scope";

export interface CashFlowMonth {
  month: string;
  inflow: number;
  salaryOutflow: number;
  purchaseOutflow: number;
  expenseOutflow: number;
  outflow: number;
  net: number;
}

function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7); // yyyy-mm
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Cash Flow — HISTORICAL movement only, never "Forecast".
 * Inflow = ClientPayment. Outflow = SalaryPayment (cash paid) + material
 * purchases + manual expenses. Salary cost is recognised at attendance time
 * elsewhere; here only actual cash out matters.
 */
export async function getCashFlow(
  scope?: Pick<ReportScope, "from" | "to" | "projectId">,
): Promise<CashFlowMonth[]> {
  const dm = dateMatch(scope);
  const projectMatch = idMatch("project", scope?.projectId);
  const [inflowRows, salaryRows, purchaseRows, expenseRows] = await Promise.all([
    ClientPayment.aggregate([
      { $match: { ...dm, ...projectMatch } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
          amount: { $sum: "$amount" },
        },
      },
    ]),
    SalaryPayment.aggregate([
      { $match: dm },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
          amount: { $sum: "$amount" },
        },
      },
    ]),
    StockTransaction.aggregate([
      { $match: { type: "purchase", ...dm, ...projectMatch } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
          amount: { $sum: "$total" },
        },
      },
    ]),
    Expense.aggregate([
      { $match: { ...dm, ...projectMatch } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
          amount: { $sum: "$amount" },
        },
      },
    ]),
  ]);
  const inflow = new Map<string, number>();
  const salary = new Map<string, number>();
  const purchase = new Map<string, number>();
  const expense = new Map<string, number>();
  for (const r of inflowRows as Array<{ _id: string; amount: number }>) inflow.set(r._id, r.amount);
  for (const r of salaryRows as Array<{ _id: string; amount: number }>) salary.set(r._id, r.amount);
  for (const r of purchaseRows as Array<{ _id: string; amount: number }>) purchase.set(r._id, r.amount);
  for (const r of expenseRows as Array<{ _id: string; amount: number }>) expense.set(r._id, r.amount);

  // Month buckets: explicit range when scoped, else trailing 6 months.
  const keys: string[] = [];
  if (scope?.from || scope?.to) {
    const start = new Date(`${(scope.from ?? scope.to) as string}T00:00:00Z`);
    const end = new Date(`${(scope.to ?? scope.from) as string}T00:00:00Z`);
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    while (cursor <= last) {
      keys.push(monthKey(cursor));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  } else {
    const now = new Date();
    const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    cursor.setUTCMonth(cursor.getUTCMonth() - 5);
    for (let i = 0; i < 6; i++) {
      keys.push(monthKey(cursor));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }
  // Include out-of-range months that carry data (no silent drops).
  for (const k of new Set([...inflow.keys(), ...salary.keys(), ...purchase.keys(), ...expense.keys()])) {
    if (!keys.includes(k)) keys.push(k);
  }
  keys.sort();

  return keys.map((k) => {
    const i = Math.round(inflow.get(k) ?? 0);
    const s = Math.round(salary.get(k) ?? 0);
    const p = Math.round(purchase.get(k) ?? 0);
    const e = Math.round(expense.get(k) ?? 0);
    const outflow = s + p + e;
    return {
      month: monthLabel(k),
      inflow: i,
      salaryOutflow: s,
      purchaseOutflow: p,
      expenseOutflow: e,
      outflow,
      net: i - outflow,
    };
  });
}
