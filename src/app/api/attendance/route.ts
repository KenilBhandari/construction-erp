import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth, idempotencyKeyFrom } from "@/lib/api";
import { objectIdSchema, paginationSchema } from "@/lib/validation";
import { attendanceBulkSchema } from "@/lib/schemas";
import { toDayDate, dayRange, attendanceCostFor, perRecordIdempotencyKey } from "@/lib/utils";
import { recomputeSalariesFor, handleAttendanceChangeForReconciliation } from "@/lib/salary";
import { Attendance } from "@/models/Attendance";
import { Labour } from "@/models/Labour";
import { Site } from "@/models/Site";
import { ATTENDANCE_STATUSES } from "@/types/attendance";
import { Types } from "mongoose";

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
      ["labour", labour],
    ] as const) {
      if (value) {
        const parsed = objectIdSchema.safeParse(value);
        if (parsed.success) filter[key] = parsed.data;
      }
    }
    if (site) {
      if (site === "null" || site === "none" || site === "__none" || site === "No Site") {
        filter.site = null;
      } else {
        const parsed = objectIdSchema.safeParse(site);
        if (parsed.success) filter.site = parsed.data;
      }
    }
    if (status && (ATTENDANCE_STATUSES as readonly string[]).includes(status)) {
      filter.status = status;
    }

    const [data, total] = await Promise.all([
      Attendance.find(filter)
        .populate("labour", "name skill phone")
        .populate({ path: "site", select: "name", strictPopulate: false })
        .populate({ path: "project", select: "name", strictPopulate: false })
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

/** Bulk save attendance for a date — site optional, labour+date unique. */
export async function POST(req: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    await connectDB();
    const body = attendanceBulkSchema.parse(await req.json());
    const headerKey = idempotencyKeyFrom(req);

    const date = toDayDate(body.date);

    // Idempotency: if header key present and all records already have per-record keys, return cached
    if (headerKey) {
      const perKeys = body.records.map((r) => perRecordIdempotencyKey(headerKey, r.labour, body.date));
      const existing = await Attendance.countDocuments({ idempotencyKey: { $in: perKeys } });
      if (existing === body.records.length && existing > 0) {
        return ok({ saved: body.records.length, insertedOrUpdated: existing, date: body.date, idempotent: true });
      }
    }

    const labourIds = [...new Set(body.records.map((r) => r.labour))];
    const labourDocs = await Labour.find({ _id: { $in: labourIds } })
      .select("dailyRate hourlyRate")
      .lean();
    const labourMap = new Map<string, { dailyRate: number; hourlyRate: number }>();
    for (const d of labourDocs) labourMap.set(String(d._id), { dailyRate: d.dailyRate ?? 0, hourlyRate: d.hourlyRate ?? 0 });
    if (labourMap.size !== labourIds.length) {
      return fail(new Error("One or more workers were not found."), 404);
    }

    const allSiteIds = new Set<string>();
    if (body.site) allSiteIds.add(body.site);
    for (const r of body.records) {
      const rs = (r as { site?: string | null }).site;
      if (rs) allSiteIds.add(rs);
    }
    const projectMap = new Map<string, Types.ObjectId>();
    if (allSiteIds.size > 0) {
      const siteDocs = await Site.find({ _id: { $in: [...allSiteIds] } })
        .select("project")
        .lean();
      const found = new Set(siteDocs.map((d) => String(d._id)));
      for (const sid of allSiteIds) {
        if (!found.has(sid)) return fail(new Error(`Selected site not found: ${sid}`), 404);
      }
      for (const d of siteDocs) {
        projectMap.set(String(d._id), d.project as Types.ObjectId);
      }
    }

    let defaultSiteOid: Types.ObjectId | null = null;
    let defaultProjectOid: Types.ObjectId | null = null;
    if (body.site) {
      defaultSiteOid = new Types.ObjectId(body.site);
      defaultProjectOid = projectMap.get(body.site) ?? null;
      if (!defaultProjectOid) return fail(new Error("Selected site not found."), 404);
    }
    const ops: Array<{ updateOne: { filter: Record<string, unknown>; update: Record<string, unknown>; upsert: boolean } }> = [];
    const seen = new Set<string>();
    for (const r of body.records) {
      const key = `${r.labour}:${body.date}`;
      if (seen.has(key)) {
        return fail(new Error(`Duplicate labour ${r.labour} in request for ${body.date}.`), 422);
      }
      seen.add(key);

      let siteOid: Types.ObjectId | null = defaultSiteOid;
      let projectOid: Types.ObjectId | null = defaultProjectOid;

      const recSite = (r as { site?: string | null }).site;
      if (recSite !== undefined) {
        if (recSite) {
          siteOid = new Types.ObjectId(recSite);
          projectOid = projectMap.get(recSite) ?? null;
          if (!projectOid) return fail(new Error(`Selected site not found for labour ${r.labour}.`), 404);
        } else {
          siteOid = null;
          projectOid = null;
        }
      }

      const rates = labourMap.get(r.labour)!;
      const cost = attendanceCostFor(r.status, rates.dailyRate);
      const perKey = headerKey ? perRecordIdempotencyKey(headerKey, r.labour, body.date) : null;

      const filter = { labour: new Types.ObjectId(r.labour), date };
      const baseUpdate: Record<string, unknown> = {
        status: r.status,
        site: siteOid,
        project: projectOid,
        notes: (r as { notes?: string | null }).notes ?? null,
        dailyRateSnapshot: rates.dailyRate,
        hourlyRateSnapshot: rates.hourlyRate,
        cost,
      };
      if (perKey) (baseUpdate as Record<string, unknown>).idempotencyKey = perKey;

      if (body.overwrite) {
        ops.push({ updateOne: { filter, update: { $set: baseUpdate }, upsert: true } });
      } else {
        ops.push({
          updateOne: {
            filter,
            update: {
              $setOnInsert: baseUpdate,
            },
            upsert: true,
          },
        });
      }
    }

    if (ops.length > 0) {
      await Attendance.bulkWrite(ops as unknown as Parameters<typeof Attendance.bulkWrite>[0], { ordered: false });
    }

    try {
      await recomputeSalariesFor(labourIds, date);
      await handleAttendanceChangeForReconciliation(labourIds, date);
    } catch (err) {
      console.warn("[attendance] salary recompute skipped:", (err as Error).message);
    }

    const afterCount = await Attendance.countDocuments({ labour: { $in: labourIds }, date });

    return ok({ saved: ops.length, insertedOrUpdated: afterCount, date: body.date });
  } catch (err) {
    return fail(err, 422);
  }
}
