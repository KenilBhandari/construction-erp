import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth, idempotencyKeyFrom } from "@/lib/api";
import { objectIdSchema } from "@/lib/validation";
import { overtimeUpdateSchema } from "@/lib/schemas";
import { updateOvertime } from "@/lib/overtime";
import { recomputeSalariesFor, handleAttendanceChangeForReconciliation } from "@/lib/salary";
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
    const headerKey = idempotencyKeyFrom(req);
    try {
      const record = await updateOvertime(id, {
        hours: body.hours,
        rate: body.rate,
        site: body.site,
        notes: body.notes,
        idempotencyKey: headerKey ?? undefined,
      });
      return ok(record);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("not found")) return fail(e, 404);
      throw e;
    }
  } catch (err) {
    return fail(err, 422);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const id = await getId(params);
    await connectDB();
    const deleted = await Overtime.findByIdAndDelete(id).lean();
    if (!deleted) return ok({ deleted: true, idempotent: true });
    try {
      await recomputeSalariesFor([String(deleted.labour)], deleted.date);
      await handleAttendanceChangeForReconciliation([String(deleted.labour)], deleted.date);
    } catch (err) {
      console.warn("[overtime] salary recompute skipped:", (err as Error).message);
    }
    return ok({ deleted: true });
  } catch (err) {
    return fail(err);
  }
}
