import { Types } from "mongoose";
import { Material } from "@/models/Material";
import { StockTransaction } from "@/models/StockTransaction";
import { dateMatch, idMatch, type ReportScope } from "@/lib/reports/scope";

export interface MaterialMovementRow {
  materialId: string;
  name: string;
  unit: string | null;
  purchased: number;
  consumed: number;
  returned: number;
  adjustment: number;
  current: number;
}

/**
 * Material Movement — purchase / consumption / return / adjustment quantities.
 * Quantities are sums of recorded transaction quantities in scope.
 */
export async function getMaterialMovement(
  scope?: ReportScope & { materialId?: string },
): Promise<MaterialMovementRow[]> {
  const match = {
    ...dateMatch(scope),
    ...idMatch("project", scope?.projectId),
    ...idMatch("site", scope?.siteId),
    ...idMatch("material", scope?.materialId),
  };
  const rows = await StockTransaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: { material: "$material", type: "$type" },
        quantity: { $sum: "$quantity" },
      },
    },
    {
      $group: {
        _id: "$_id.material",
        flows: { $push: { type: "$_id.type", quantity: "$quantity" } },
      },
    },
    {
      $lookup: { from: Material.collection.name, localField: "_id", foreignField: "_id", as: "mat" },
    },
    { $unwind: { path: "$mat", preserveNullAndEmptyArrays: true } },
    { $sort: { "mat.name": 1 } },
  ]);
  return (
    rows as Array<{
      _id: Types.ObjectId;
      flows: Array<{ type: string; quantity: number }>;
      mat?: { name?: string; unit?: string | null; currentStock?: number };
    }>
  ).map((r) => {
    const flow = (t: string) =>
      Math.abs(r.flows.find((f) => f.type === t)?.quantity ?? 0);
    return {
      materialId: String(r._id),
      name: r.mat?.name ?? "—",
      unit: r.mat?.unit ?? null,
      purchased: flow("purchase"),
      consumed: flow("consumption"),
      returned: flow("return"),
      adjustment: r.flows.find((f) => f.type === "adjustment")?.quantity ?? 0,
      current: r.mat?.currentStock ?? 0,
    };
  });
}

export type ValuationRateSource = "default-rate" | "last-purchase-rate" | "unavailable";

export interface StockValuationRow {
  materialId: string;
  name: string;
  unit: string | null;
  quantity: number;
  rate: number;
  rateSource: ValuationRateSource;
  /** Estimated value only — not FIFO / average-cost accounting. */
  estimatedValue: number;
}

/**
 * Estimated Stock Valuation — currentStock × valuation rate, with the rate
 * source in every row so the report is auditable. Labelled "Estimated" in UI.
 */
export async function getStockValuation(scope?: { materialId?: string }): Promise<StockValuationRow[]> {
  const materials = await Material.find({ ...idMatch("_id", scope?.materialId) })
    .sort({ name: 1 })
    .select("name unit currentStock defaultPurchaseRate")
    .lean();
  return Promise.all(
    materials.map(async (m) => {
      let rate = (m.defaultPurchaseRate as number | null) ?? null;
      let rateSource: ValuationRateSource = "default-rate";
      if (rate === null || rate === undefined) {
        const last = await StockTransaction.find({ material: m._id, type: "purchase" })
          .sort({ date: -1 })
          .select("rate")
          .limit(1)
          .lean();
        const lastRate = last[0]?.rate as number | null | undefined;
        if (lastRate !== null && lastRate !== undefined) {
          rate = lastRate;
          rateSource = "last-purchase-rate";
        } else {
          rate = 0;
          rateSource = "unavailable";
        }
      }
      const quantity = (m.currentStock as number) ?? 0;
      return {
        materialId: String(m._id),
        name: (m.name as string) ?? "—",
        unit: (m.unit as string | null) ?? null,
        quantity,
        rate,
        rateSource,
        estimatedValue: Math.round(quantity * rate),
      };
    }),
  );
}

export interface PurchaseConsumptionRow {
  materialId: string;
  name: string;
  unit: string | null;
  purchased: number;
  consumed: number;
  returned: number;
  adjustments: number;
  /** Lifetime expected remainder from flows. Present ONLY when unscoped (see below). */
  expectedRemaining: number | null;
  actualStock: number;
  /**
   * Variance = actual − expected. Shown ONLY with no project/site filter:
   * stock is global per material, so scoped flows cannot be compared to it.
   * Scoped views return null here — flows only, never manufactured variance.
   */
  variance: number | null;
}

/**
 * Purchase vs Consumption — where the material actually went.
 * Honest by construction: variance exists only for lifetime, unfiltered flows.
 */
export async function getPurchaseConsumption(
  scope?: ReportScope & { materialId?: string },
): Promise<PurchaseConsumptionRow[]> {
  const unscoped = !scope?.projectId && !scope?.siteId;
  const movement = await getMaterialMovement(scope);
  return movement.map((m) => {
    const expected = m.purchased - m.consumed + m.returned + m.adjustment;
    return {
      materialId: m.materialId,
      name: m.name,
      unit: m.unit,
      purchased: m.purchased,
      consumed: m.consumed,
      returned: m.returned,
      adjustments: m.adjustment,
      expectedRemaining: unscoped ? expected : null,
      actualStock: m.current,
      variance: unscoped ? Math.round((m.current - expected) * 100) / 100 : null,
    };
  });
}
