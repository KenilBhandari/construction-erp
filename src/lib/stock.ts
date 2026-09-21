import { Material } from "@/models/Material";
import type { TransactionType } from "@/types/inventory";

/** Signed stock effect. Purchase/return add; consumption subtracts; adjustment is signed. */
export function stockEffect(type: TransactionType, quantity: number): number {
  switch (type) {
    case "purchase":
    case "return":
      return Math.abs(quantity);
    case "consumption":
      return -Math.abs(quantity);
    case "adjustment":
      return quantity;
  }
}

/**
 * Apply a stock effect. Consumption uses a conditional update so concurrent
 * entries can't drive stock negative; other types increment directly.
 */
export async function applyStockEffect(materialId: string, effect: number) {
  if (effect < 0) {
    const updated = await Material.findOneAndUpdate(
      { _id: materialId, currentStock: { $gte: -effect } },
      { $inc: { currentStock: effect } },
      { new: true },
    ).lean();
    if (!updated) {
      throw new Error("Not enough stock — this would drive inventory negative.");
    }
    return updated;
  }
  const updated = await Material.findByIdAndUpdate(
    materialId,
    { $inc: { currentStock: effect } },
    { new: true },
  ).lean();
  if (!updated) throw new Error("Material not found.");
  return updated;
}
