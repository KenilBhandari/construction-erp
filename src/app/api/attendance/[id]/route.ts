import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth } from "@/lib/api";
import { objectIdSchema } from "@/lib/validation";
import { attendanceUpdateSchema } from "@/lib/schemas";
import { recomputeSalariesFor } from "@/lib/salary";
import { Attendance } from "@/models/Attendance";

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
    const record = await Attendance.findById(id)
      .populate("labour", "name skill")
      .populate("site", "name")
      .populate("project", "name")
      .lean();
    if (!record) return fail(new Error("Attendance record not found."), 404);
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
    // Labour/site/date never move — corrections only (keeps history sound).
    const body = attendanceUpdateSchema.parse(await req.json());
    const updated = await Attendance.findByIdAndUpdate(id, { $set: body }, {
      new: true,
      runValidators: true,
    }).lean();
    if (!updated) return fail(new Error("Attendance record not found."), 404);
    try {
      await recomputeSalariesFor([String(updated.labour)], updated.date);
    } catch (err) {
      console.warn("[attendance] salary recompute skipped:", (err as Error).message);
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
    const deleted = await Attendance.findByIdAndDelete(id).lean();
    if (!deleted) return fail(new Error("Attendance record not found."), 404);
    try {
      await recomputeSalariesFor([String(deleted.labour)], deleted.date);
    } catch (err) {
      console.warn("[attendance] salary recompute skipped:", (err as Error).message);
    }
    return ok({ deleted: true });
  } catch (err) {
    return fail(err);
  }
}
