import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth } from "@/lib/api";
import { objectIdSchema } from "@/lib/validation";
import { stockUpdateSchema } from "@/lib/schemas";
import { toDayDate } from "@/lib/utils";
import { applyStockEffect, stockEffect } from "@/lib/stock";
import { StockTransaction } from "@/models/StockTransaction";

async function getId(params: Promise<{ id: string }>) {
  const { id } = await params;
  return objectIdSchema.parse(id);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const id = await getId(params);
    await connectDB();
    const txn = await StockTransaction.findById(id)
      .populate("material", "name unit")
      .populate("project", "name")
      .populate("site", "name")
      .lean();
    if (!txn) return fail(new Error("Transaction not found."), 404);
    return ok(txn);
  } catch (err) {
    return fail(err);
  }
}

/**
 * Edit quantities/details. The old stock effect is reversed first, then the
 * new one applied — both guarded so stock never goes negative.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const id = await getId(params);
    await connectDB();
    const body = stockUpdateSchema.parse(await req.json());
    const existing = await StockTransaction.findById(id);
    if (!existing) return fail(new Error("Transaction not found."), 404);

    const nextQty = body.quantity ?? existing.quantity;
    if (existing.type === "adjustment" ? nextQty === 0 : nextQty <= 0) {
      return fail(new Error("Invalid quantity for this transaction type."), 400);
    }
    const nextRate = body.rate ?? existing.rate;
    const nextTotal =
      existing.type === "purchase" ? Math.round(Math.abs(nextQty) * nextRate) : existing.total;

    const materialId = String(existing.material);
    const oldEffect = stockEffect(existing.type, existing.quantity);
    const newEffect = stockEffect(existing.type, nextQty);
    // Reverse old effect, then apply the new one.
    try {
      await applyStockEffect(materialId, -oldEffect);
    } catch (stockErr) {
      return fail(stockErr, 400);
    }
    try {
      await applyStockEffect(materialId, newEffect);
    } catch (stockErr) {
      // Restore — the old effect was valid before, so this always applies.
      await applyStockEffect(materialId, oldEffect);
      return fail(stockErr, 400);
    }

    existing.quantity = nextQty;
    existing.rate = nextRate;
    existing.total = nextTotal;
    if (body.date !== undefined) existing.date = toDayDate(body.date);
    if (body.supplier !== undefined) existing.supplier = body.supplier;
    if (body.invoiceNumber !== undefined) existing.invoiceNumber = body.invoiceNumber;
    if (body.purpose !== undefined) existing.purpose = body.purpose;
    if (body.notes !== undefined) existing.notes = body.notes;
    await existing.save();

    return ok(existing.toObject());
  } catch (err) {
    return fail(err, 422);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const id = await getId(params);
    await connectDB();
    const existing = await StockTransaction.findById(id);
    if (!existing) return fail(new Error("Transaction not found."), 404);

    try {
      await applyStockEffect(
        String(existing.material),
        -stockEffect(existing.type, existing.quantity),
      );
    } catch {
      return fail(
        new Error(
          "Deleting this would drive stock negative — later consumption depends on it. Add a correcting adjustment instead.",
        ),
        400,
      );
    }
    await existing.deleteOne();
    return ok({ deleted: true });
  } catch (err) {
    return fail(err);
  }
}
