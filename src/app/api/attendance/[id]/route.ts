import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth, idempotencyKeyFrom } from "@/lib/api";
import { objectIdSchema } from "@/lib/validation";
import { attendanceUpdateSchema } from "@/lib/schemas";
import { recomputeSalariesFor, handleAttendanceChangeForReconciliation } from "@/lib/salary";
import { attendanceCostFor } from "@/lib/utils";
import { Attendance } from "@/models/Attendance";
import { Labour } from "@/models/Labour";

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

    const headerKey = idempotencyKeyFrom(req);
    if (headerKey) {
      const existingByKey = await Attendance.findOne({ idempotencyKey: headerKey }).lean();
      if (existingByKey) return ok(existingByKey);
    }

    const existing = await Attendance.findById(id);
    if (!existing) return fail(new Error("Attendance record not found."), 404);

    let statusChanged = false;
    let siteChanged = false;
    if (body.status !== undefined && body.status !== existing.status) {
      existing.status = body.status as typeof existing.status;
      statusChanged = true;
    }
    if (body.notes !== undefined) existing.notes = body.notes ?? null;

    if (body.site !== undefined) {
      const prevSite = String(existing.site ?? "");
      const newSite = body.site ? String(body.site) : "";
      if (prevSite !== newSite) siteChanged = true;
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

    // If status or site changed, or cost snapshot missing, recompute cost from current labour rate snapshot logic
    if (statusChanged || siteChanged || existing.cost === undefined || existing.dailyRateSnapshot == null) {
      // For status changes, we keep original dailyRateSnapshot if exists; else fetch current.
      let dailyRate = existing.dailyRateSnapshot as number | null;
      let hourlyRate = existing.hourlyRateSnapshot as number | null;
      if (dailyRate == null || hourlyRate == null) {
        const labour = await Labour.findById(existing.labour).select("dailyRate hourlyRate").lean();
        if (labour) {
          dailyRate = labour.dailyRate ?? 0;
          hourlyRate = labour.hourlyRate ?? 0;
          existing.dailyRateSnapshot = dailyRate;
          existing.hourlyRateSnapshot = hourlyRate;
        }
      }
      // If status changed, cost must reflect that status using snapshot; if only site changed, status same so cost same.
      if (statusChanged || existing.cost == null) {
        existing.cost = attendanceCostFor(existing.status, (dailyRate ?? 0) as number);
      }
      // If site changed without status change, cost unchanged (site attribution moves, amount stays).
    }

    if (headerKey) (existing as unknown as Record<string, unknown>).idempotencyKey = headerKey;

    await existing.save();

    try {
      await recomputeSalariesFor([String(existing.labour)], existing.date);
      await handleAttendanceChangeForReconciliation([String(existing.labour)], existing.date);
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
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const id = await getId(params);
    await connectDB();
    // Idempotent delete: second delete returns success (headerKey makes retry safe via 404→success)
    void idempotencyKeyFrom(req);
    const deleted = await Attendance.findByIdAndDelete(id).lean();
    if (!deleted) {
      // Second delete with same idempotency is idempotent success
      return ok({ deleted: true, idempotent: true });
    }
    try {
      const { Overtime } = await import("@/models/Overtime");
      const { toDayDate } = await import("@/lib/utils");
      const day = toDayDate(deleted.date as unknown as string | Date);
      await Overtime.deleteMany({ labour: deleted.labour, date: day });
    } catch (err) {
      console.warn("[attendance] OT cascade delete skipped:", (err as Error).message);
    }
    try {
      await recomputeSalariesFor([String(deleted.labour)], deleted.date);
      await handleAttendanceChangeForReconciliation([String(deleted.labour)], deleted.date);
    } catch (err) {
      console.warn("[attendance] salary recompute skipped:", (err as Error).message);
    }
    return ok({ deleted: true });
  } catch (err) {
    return fail(err);
  }
}
