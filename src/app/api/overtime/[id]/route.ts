import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth } from "@/lib/api";
import { objectIdSchema } from "@/lib/validation";
import { overtimeUpdateSchema } from "@/lib/schemas";
import { calculateOvertimeAmount } from "@/lib/calculations";
import { recomputeSalariesFor } from "@/lib/salary";
import { Overtime } from "@/models/Overtime";

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
    const record = await Overtime.findById(id)
      .populate("labour", "name")
      .populate("site", "name")
      .populate("project", "name")
      .lean();
    if (!record) return fail(new Error("Overtime record not found."), 404);
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
    const body = overtimeUpdateSchema.parse(await req.json());
    const existing = await Overtime.findById(id);
    if (!existing) return fail(new Error("Overtime record not found."), 404);

    if (body.hours !== undefined) existing.hours = body.hours;
    if (body.rate !== undefined) existing.rate = body.rate;
    if (body.hours !== undefined || body.rate !== undefined) {
      existing.amount = Math.round(
        calculateOvertimeAmount(existing.hours, existing.rate),
      );
    }
    if (body.notes !== undefined) existing.notes = body.notes;
    await existing.save();
    try {
      await recomputeSalariesFor([String(existing.labour)], existing.date);
    } catch (err) {
      console.warn("[overtime] salary recompute skipped:", (err as Error).message);
    }

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
    const deleted = await Overtime.findByIdAndDelete(id).lean();
    if (!deleted) return fail(new Error("Overtime record not found."), 404);
    try {
      await recomputeSalariesFor([String(deleted.labour)], deleted.date);
    } catch (err) {
      console.warn("[overtime] salary recompute skipped:", (err as Error).message);
    }
    return ok({ deleted: true });
  } catch (err) {
    return fail(err);
  }
}
