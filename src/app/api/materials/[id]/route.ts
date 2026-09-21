import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth } from "@/lib/api";
import { objectIdSchema } from "@/lib/validation";
import { materialUpdateSchema } from "@/lib/schemas";
import { Material } from "@/models/Material";
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
    const material = await Material.findById(id).lean();
    if (!material) return fail(new Error("Material not found."), 404);
    return ok(material);
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const id = await getId(params);
    await connectDB();
    // currentStock is transaction-derived — never edited directly.
    const body = materialUpdateSchema.parse(await req.json());
    const updated = await Material.findByIdAndUpdate(id, { $set: body }, {
      new: true,
      runValidators: true,
    }).lean();
    if (!updated) return fail(new Error("Material not found."), 404);
    return ok(updated);
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
    const txnCount = await StockTransaction.countDocuments({ material: id });
    if (txnCount > 0) {
      return fail(
        new Error(
          "This material has stock transactions — it cannot be deleted. Set minimum stock to 0 and leave it unused instead.",
        ),
        400,
      );
    }
    const deleted = await Material.findByIdAndDelete(id).lean();
    if (!deleted) return fail(new Error("Material not found."), 404);
    return ok({ deleted: true });
  } catch (err) {
    return fail(err);
  }
}
