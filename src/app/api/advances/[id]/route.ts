import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth } from "@/lib/api";
import { objectIdSchema } from "@/lib/validation";
import { advanceUpdateSchema } from "@/lib/schemas";
import { toDayDate } from "@/lib/utils";
import { recomputeSalariesFor } from "@/lib/salary";
import { LabourAdvance } from "@/models/LabourAdvance";
import { Site } from "@/models/Site";

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
    const record = await LabourAdvance.findById(id)
      .populate("labour", "name")
      .populate("site", "name")
      .lean();
    if (!record) return fail(new Error("Advance not found."), 404);
    return ok(record);
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
    const body = advanceUpdateSchema.parse(await req.json());
    if (body.site) {
      const siteExists = await Site.exists({ _id: body.site });
      if (!siteExists) return fail(new Error("Selected site not found."), 404);
    }
    const before = await LabourAdvance.findById(id).select("labour date").lean();
    if (!before) return fail(new Error("Advance not found."), 404);
    const updated = await LabourAdvance.findByIdAndUpdate(
      id,
      {
        ...(body.date !== undefined ? { date: toDayDate(body.date) } : {}),
        ...(body.amount !== undefined ? { amount: body.amount } : {}),
        ...(body.reason !== undefined ? { reason: body.reason } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.site !== undefined ? { site: body.site } : {}),
      },
      { new: true, runValidators: true },
    ).lean();
    if (!updated) return fail(new Error("Advance not found."), 404);
    try {
      // Date may have moved — refresh periods covering old and new dates.
      await recomputeSalariesFor([String(before.labour)], before.date);
      await recomputeSalariesFor([String(updated.labour)], updated.date);
    } catch (err) {
      console.warn("[advances] salary recompute skipped:", (err as Error).message);
    }
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
    const deleted = await LabourAdvance.findByIdAndDelete(id).lean();
    if (!deleted) return fail(new Error("Advance not found."), 404);
    try {
      await recomputeSalariesFor([String(deleted.labour)], deleted.date);
    } catch (err) {
      console.warn("[advances] salary recompute skipped:", (err as Error).message);
    }
    return ok({ deleted: true });
  } catch (err) {
    return fail(err);
  }
}
