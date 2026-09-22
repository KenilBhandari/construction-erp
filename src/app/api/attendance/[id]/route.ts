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
      .populate("labour", "name skill phone")
      .populate({ path: "site", select: "name", strictPopulate: false })
      .populate({ path: "project", select: "name", strictPopulate: false })
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
    const body = attendanceUpdateSchema.parse(await req.json());

    const existing = await Attendance.findById(id);
    if (!existing) return fail(new Error("Attendance record not found."), 404);

    if (body.status !== undefined) existing.status = body.status as typeof existing.status;
    if (body.notes !== undefined) existing.notes = body.notes ?? null;

    if (body.site !== undefined) {
      if (body.site) {
        const { Site } = await import("@/models/Site");
        const siteDoc = await Site.findById(body.site).select("project").lean();
        if (!siteDoc?.project) return fail(new Error("Selected site not found."), 404);
        existing.site = body.site as unknown as typeof existing.site;
        existing.project = siteDoc.project as unknown as typeof existing.project;
      } else {
        existing.site = null as unknown as typeof existing.site;
        existing.project = null as unknown as typeof existing.project;
      }
    }

    await existing.save();

    try {
      await recomputeSalariesFor([String(existing.labour)], existing.date);
    } catch (err) {
      console.warn("[attendance] salary recompute skipped:", (err as Error).message);
    }
    const populated = await Attendance.findById(id)
      .populate("labour", "name skill phone")
      .populate({ path: "site", select: "name", strictPopulate: false })
      .populate({ path: "project", select: "name", strictPopulate: false })
      .lean();
    return ok(populated);
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
