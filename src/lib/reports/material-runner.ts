import { Material } from "@/models/Material";
import { StockTransaction } from "@/models/StockTransaction";
import { stockEffect } from "@/lib/stock";
import { toDayDate } from "@/lib/utils";
import { dateMatch, idMatch, type ReportScope } from "@/lib/reports/scope";
import { REPORT_PAGE_SIZE } from "@/lib/reports/project-runner";
import { getStockRecords, type StockRecord } from "@/lib/reports/records";

export interface MaterialTrendMonth {
  month: string;
  purchased: number;
  consumed: number;
}

export interface MaterialReport {
  header: { materialId: string; name: string; unit: string | null };
  /**
   * Opening/closing reconcile against live currentStock — valid ONLY when no
   * project/site filter is active (stock is global per material). Scoped views
   * return null here and show flows only, never manufactured balances.
   */
  summary: {
    opening: number | null;
    purchased: number;
    consumed: number;
    returned: number;
    adjustments: number;
    closing: number | null;
    current: number;
  };
  trend: MaterialTrendMonth[];
  history: { rows: StockRecord[]; total: number };
  generatedAt: Date;
}

/**
 * Materials runner — what happened to one material over time.
 * Opening(at from) = current − flows on/after from.
 * Closing(at to) = current − flows after to.
 */
export async function getMaterialReport(
  scope: Pick<ReportScope, "from" | "to" | "projectId" | "siteId"> & {
    materialId?: string;
    page?: number;
    pageSize?: number;
  },
): Promise<MaterialReport> {
  if (!scope.materialId) throw new Error("Material is required for this report.");
  const material = await Material.findById(scope.materialId).lean();
  if (!material) throw new Error("Material not found.");
  const mid = material._id;
  const unscoped = !scope.projectId && !scope.siteId;
  const match = {
    ...dateMatch(scope),
    ...idMatch("project", scope?.projectId),
    ...idMatch("site", scope?.siteId),
    material: mid,
  };

  const [flows, trendRows, history] = await Promise.all([
    StockTransaction.aggregate([
      { $match: match },
      { $group: { _id: "$type", quantity: { $sum: "$quantity" } } },
    ]),
    StockTransaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            month: { $dateToString: { format: "%Y-%m", date: "$date" } },
            type: "$type",
          },
          quantity: { $sum: "$quantity" },
        },
      },
      { $sort: { "_id.month": 1 } },
    ]),
    getStockRecords(scope, scope.page ?? 1, scope.pageSize ?? REPORT_PAGE_SIZE),
  ]);

  const qty = (t: string) =>
    Math.abs((flows as Array<{ _id: string; quantity: number }>).find((f) => f._id === t)?.quantity ?? 0);
  const signedAdj =
    (flows as Array<{ _id: string; quantity: number }>).find((f) => f._id === "adjustment")?.quantity ?? 0;
  const purchased = qty("purchase");
  const consumed = qty("consumption");
  const returned = qty("return");

  // Lifetime signed effects for opening/closing (unscoped only).
  let opening: number | null = null;
  let closing: number | null = null;
  const current = (material.currentStock as number) ?? 0;
  if (unscoped && (scope.from || scope.to)) {
    const afterFrom =
      scope.from
        ? await StockTransaction.aggregate([
            { $match: { material: mid, date: { $gte: toDayDate(scope.from) } } },
            { $group: { _id: "$type", quantity: { $sum: "$quantity" } } },
          ])
        : [];
    const afterTo =
      scope.to
        ? await StockTransaction.aggregate([
            {
              $match: {
                material: mid,
                date: { $gt: new Date(`${scope.to}T23:59:59.999Z`) },
              },
            },
            { $group: { _id: "$type", quantity: { $sum: "$quantity" } } },
          ])
        : [];
    const effect = (rows: Array<{ _id: string; quantity: number }>) =>
      rows.reduce((s, r) => s + stockEffect(r._id as "purchase" | "consumption" | "adjustment" | "return", r.quantity), 0);
    if (scope.from) opening = Math.round((current - effect(afterFrom)) * 100) / 100;
    if (scope.to) closing = Math.round((current - effect(afterTo)) * 100) / 100;
  } else if (unscoped) {
    // Lifetime view: opening is 0-basis, closing is current.
    opening = 0;
    closing = current;
  }

  const months = new Map<string, { purchased: number; consumed: number }>();
  for (const r of trendRows as Array<{ _id: { month: string; type: string }; quantity: number }>) {
    const cur = months.get(r._id.month) ?? { purchased: 0, consumed: 0 };
    if (r._id.type === "purchase") cur.purchased += r.quantity;
    if (r._id.type === "consumption") cur.consumed += Math.abs(r.quantity);
    months.set(r._id.month, cur);
  }
  const trend: MaterialTrendMonth[] = [...months.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, v]) => ({ month, purchased: v.purchased, consumed: v.consumed }));

  return {
    header: {
      materialId: String(mid),
      name: (material.name as string) ?? "—",
      unit: (material.unit as string | null) ?? null,
    },
    summary: { opening, purchased, consumed, returned, adjustments: signedAdj, closing, current },
    trend,
    history,
    generatedAt: new Date(),
  };
}
