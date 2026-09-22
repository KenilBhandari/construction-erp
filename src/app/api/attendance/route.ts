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
    // Site filter: supports site ObjectId, or "null"/"none" for No Site (site is null)
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

    const date = toDayDate(body.date);

    const labourIds = [...new Set(body.records.map((r) => r.labour))];
    const existingCount = await Labour.countDocuments({ _id: { $in: labourIds } });
    if (existingCount !== labourIds.length) {
      return fail(new Error("One or more workers were not found."), 404);
    }

    // Batch fetch sites for all records + default to avoid N queries
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
    // For each record, resolve site/project (per-record site overrides bulk default)
    // Use bulkWrite for performance and duplicate protection (unique labour+date)
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

      // Per-record site overrides default
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

      const filter = { labour: new Types.ObjectId(r.labour), date };
      const update: Record<string, unknown> = {
        status: r.status,
        site: siteOid,
        project: projectOid,
        notes: (r as { notes?: string | null }).notes ?? null,
      };

      if (body.overwrite) {
        ops.push({ updateOne: { filter, update: { $set: update }, upsert: true } });
      } else {
        // Only create if not exists — don't overwrite existing attendance
        // Use $setOnInsert for status/site/project/notes, but still upsert
        ops.push({
          updateOne: {
            filter,
            update: {
              $setOnInsert: update,
            },
            upsert: true,
          },
        });
      }
    }

    if (ops.length > 0) {
      // For overwrite=false, we use $setOnInsert which will not modify existing.
      // Need to check which were actually inserted vs skipped.
      // bulkWrite with upsert and $setOnInsert will not overwrite existing.
      await Attendance.bulkWrite(ops as unknown as Parameters<typeof Attendance.bulkWrite>[0], { ordered: false });
    }

    // Keep computed salaries fresh (best-effort)
    try {
      await recomputeSalariesFor(labourIds, date);
    } catch (err) {
      console.warn("[attendance] salary recompute skipped:", (err as Error).message);
    }

    // Count how many were actually affected (for UI feedback)
    const afterCount = await Attendance.countDocuments({ labour: { $in: labourIds }, date });

    return ok({ saved: ops.length, insertedOrUpdated: afterCount, date: body.date });
  } catch (err) {
    return fail(err, 422);
  }
}
