import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth } from "@/lib/api";
import { toDayDate } from "@/lib/utils";
import { Attendance } from "@/models/Attendance";
import { Labour } from "@/models/Labour";
import { Site } from "@/models/Site";
import { Overtime } from "@/models/Overtime";

/**
 * GET /api/attendance/roster?date=2026-09-22
 * Returns daily muster: every active labour with their attendance (or null = Not Marked)
 * and suggestedSite (current assignment) for UX, without creating records.
 */
export async function GET(req: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    await connectDB();
    const url = new URL(req.url);
    const dateStr = url.searchParams.get("date")?.trim() ?? "";
    if (!dateStr) return fail(new Error("date is required (yyyy-mm-dd)."), 400);
    // Validate date
    const date = toDayDate(dateStr);

    // Fetch active labour, attendance and overtime for date in parallel
    const [labours, attendances, sites, overtimes] = await Promise.all([
      Labour.find({ status: "active" })
        .populate({ path: "assignedSite", select: "name", strictPopulate: false })
        .sort({ name: 1 })
        .lean(),
      Attendance.find({ date })
        .populate({ path: "site", select: "name", strictPopulate: false })
        .populate({ path: "project", select: "name", strictPopulate: false })
        .lean(),
      Site.find({ status: "active" }).select("name project").lean(),
      Overtime.find({ date })
        .populate({ path: "site", select: "name", strictPopulate: false })
        .populate({ path: "project", select: "name", strictPopulate: false })
        .lean(),
    ]);

    const attMap = new Map<string, (typeof attendances)[number]>();
    for (const a of attendances) {
      attMap.set(String(a.labour), a);
    }
    const otMap = new Map<string, (typeof overtimes)[number]>();
    for (const o of overtimes) {
      otMap.set(String(o.labour), o);
    }

    const roster = labours.map((lab) => {
      const lid = String(lab._id);
      const att = attMap.get(lid) ?? null;
      const ot = otMap.get(lid) ?? null;
      let suggestedSite: { _id: string; name: string } | null = null;
      const rawSite = lab.assignedSite as unknown;
      if (rawSite) {
        if (typeof rawSite === "string") {
          suggestedSite = { _id: rawSite, name: rawSite };
        } else if (rawSite && typeof rawSite === "object" && "name" in (rawSite as Record<string, unknown>)) {
          const obj = rawSite as { _id: unknown; name: string };
          suggestedSite = { _id: String(obj._id), name: obj.name };
        } else {
          suggestedSite = { _id: String(rawSite), name: String(rawSite) };
        }
      }
      return {
        labour: {
          _id: lid,
          name: lab.name,
          phone: lab.phone,
          skill: lab.skill,
          dailyRate: lab.dailyRate,
          hourlyRate: lab.hourlyRate,
          assignedSite: lab.assignedSite,
        },
        attendance: att
          ? {
              _id: String(att._id),
              labour: lid,
              date: att.date,
              status: att.status,
              site: att.site,
              project: att.project,
              notes: att.notes,
              overtimeHours: att.overtimeHours ?? 0,
            }
          : null,
        suggestedSite,
        overtime: ot
          ? {
              _id: String(ot._id),
              labour: lid,
              site: ot.site,
              project: ot.project,
              date: ot.date,
              hours: ot.hours,
              rate: ot.rate,
              amount: ot.amount,
              notes: ot.notes,
            }
          : null,
      };
    });

    const marked = attendances.length;
    const total = labours.length;
    const remaining = total - marked;
    const byStatus: Record<string, number> = { present: 0, "half-day": 0, absent: 0 };
    for (const a of attendances) {
      const s = a.status as string;
      if (s in byStatus) byStatus[s]++;
    }

    return ok({
      date: dateStr,
      total,
      marked,
      remaining,
      present: byStatus.present,
      halfDay: byStatus["half-day"],
      absent: byStatus.absent,
      roster,
      sites: sites.map((s) => ({ _id: String(s._id), name: s.name })),
    });
  } catch (err) {
    return fail(err);
  }
}
