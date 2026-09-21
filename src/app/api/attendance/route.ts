import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth } from "@/lib/api";
import { objectIdSchema, paginationSchema } from "@/lib/validation";
import { attendanceBulkSchema } from "@/lib/schemas";
import { toDayDate, dayRange } from "@/lib/utils";
import { recomputeSalariesFor } from "@/lib/salary";
import { Attendance } from "@/models/Attendance";
import { Labour } from "@/models/Labour";
import { Site } from "@/models/Site";
import { ATTENDANCE_STATUSES } from "@/types/attendance";

export async function GET(req: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    await connectDB();
    const url = new URL(req.url);
    const { page, limit } = paginationSchema.parse({
      page: url.searchParams.get("page"),
      limit: url.searchParams.get("limit"),
    });
    const date = url.searchParams.get("date")?.trim() ?? "";
    const from = url.searchParams.get("from")?.trim() ?? "";
    const to = url.searchParams.get("to")?.trim() ?? "";
    const project = url.searchParams.get("project")?.trim() ?? "";
    const site = url.searchParams.get("site")?.trim() ?? "";
    const labour = url.searchParams.get("labour")?.trim() ?? "";
    const status = url.searchParams.get("status")?.trim() ?? "";

    const filter: Record<string, unknown> = {};
    if (date) filter.date = toDayDate(date);
    else if (from || to) {
      const { start, end } = dayRange(from || to, to || from);
      filter.date = { $gte: start, $lte: end };
    }
    for (const [key, value] of [
      ["project", project],
      ["site", site],
      ["labour", labour],
    ] as const) {
      if (value) {
        const parsed = objectIdSchema.safeParse(value);
        if (parsed.success) filter[key] = parsed.data;
      }
    }
    if (status && (ATTENDANCE_STATUSES as readonly string[]).includes(status)) {
      filter.status = status;
    }

    const [data, total] = await Promise.all([
      Attendance.find(filter)
        .populate("labour", "name skill")
        .populate("site", "name")
        .populate("project", "name")
        .sort({ date: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Attendance.countDocuments(filter),
    ]);

    return ok({ data, page, limit, total });
  } catch (err) {
    return fail(err);
  }
}

/** Bulk save one day's attendance for a site (upsert per labour). */
export async function POST(req: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    await connectDB();
    const body = attendanceBulkSchema.parse(await req.json());

    const site = await Site.findById(body.site).select("project").lean();
    if (!site?.project) return fail(new Error("Selected site not found."), 404);

    const labourIds = [...new Set(body.records.map((r) => r.labour))];
    const existingCount = await Labour.countDocuments({ _id: { $in: labourIds } });
    if (existingCount !== labourIds.length) {
      return fail(new Error("One or more workers were not found."), 404);
    }

    const date = toDayDate(body.date);
    const project = String(site.project);

    await Promise.all(
      body.records.map((r) =>
        Attendance.findOneAndUpdate(
          { labour: r.labour, site: body.site, date },
          {
            $set: {
              project,
              status: r.status,
              checkIn: r.checkIn,
              checkOut: r.checkOut,
              overtimeHours: r.overtimeHours,
              notes: r.notes ?? null,
            },
          },
          { upsert: true, new: true, runValidators: true },
        ),
      ),
    );

    // Keep computed salaries fresh (best-effort — attendance is saved).
    try {
      await recomputeSalariesFor(labourIds, date);
    } catch (err) {
      console.warn("[attendance] salary recompute skipped:", (err as Error).message);
    }

    return ok({ saved: body.records.length, date: body.date, site: body.site });
  } catch (err) {
    return fail(err, 422);
  }
}
