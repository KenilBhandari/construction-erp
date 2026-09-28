import { Types } from "mongoose";
import { Attendance } from "@/models/Attendance";
import { Overtime } from "@/models/Overtime";
import { Labour } from "@/models/Labour";
import { Salary } from "@/models/Salary";
import { Site } from "@/models/Site";
import { dateMatch, idMatch, type ReportScope } from "@/lib/reports/scope";

export interface AttendanceRow {
  labourId: string;
  name: string;
  present: number;
  half: number;
  absent: number;
  leave: number;
  otHours: number;
}

/**
 * Attendance analysis — historical day counts per worker.
 * Optional worker filter via scope extension (labourId).
 */
export async function getAttendanceAnalysis(
  scope?: ReportScope & { labourId?: string },
): Promise<AttendanceRow[]> {
  const match = {
    ...dateMatch(scope),
    ...idMatch("project", scope?.projectId),
    ...idMatch("site", scope?.siteId),
    ...idMatch("labour", scope?.labourId),
  };
  // Day counts from Attendance; OT hours = legacy field + Overtime records (same as money).
  const [rows, otRows] = await Promise.all([
    Attendance.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$labour",
          present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
          half: { $sum: { $cond: [{ $eq: ["$status", "half-day"] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
          leave: { $sum: { $cond: [{ $eq: ["$status", "leave"] }, 1, 0] } },
          attOt: { $sum: { $ifNull: ["$overtimeHours", 0] } },
        },
      },
      {
        $lookup: { from: Labour.collection.name, localField: "_id", foreignField: "_id", as: "lab" },
      },
      { $unwind: { path: "$lab", preserveNullAndEmptyArrays: true } },
      { $sort: { present: -1 } },
    ]),
    Overtime.aggregate([
      { $match: match },
      { $group: { _id: "$labour", hours: { $sum: "$hours" } } },
    ]),
  ]);
  const otByLabour = new Map<string, number>();
  for (const r of otRows as Array<{ _id: Types.ObjectId; hours: number }>) {
    otByLabour.set(String(r._id), r.hours ?? 0);
  }
  return (rows as Array<{ _id: Types.ObjectId; present: number; half: number; absent: number; leave: number; attOt: number; lab?: { name?: string } }>).map(
    (r) => ({
      labourId: String(r._id),
      name: r.lab?.name ?? "—",
      present: r.present,
      half: r.half,
      absent: r.absent,
      leave: r.leave,
      otHours: Math.round(((r.attOt ?? 0) + (otByLabour.get(String(r._id)) ?? 0)) * 10) / 10,
    }),
  );
}

export interface SiteLabourCostRow {
  siteId: string | null;
  siteName: string;
  regularCost: number;
  otCost: number;
  total: number;
}

/** Site-wise labour cost incl. explicit Unassigned bucket (site null). */
export async function getSiteLabourCost(
  scope?: Pick<ReportScope, "from" | "to" | "projectId">,
): Promise<SiteLabourCostRow[]> {
  const base = { ...dateMatch(scope), ...idMatch("project", scope?.projectId) };
  const [attendanceRows, overtimeRows] = await Promise.all([
    Attendance.aggregate([
      { $match: base },
      { $group: { _id: "$site", cost: { $sum: { $ifNull: ["$cost", 0] } } } },
      {
        $lookup: { from: Site.collection.name, localField: "_id", foreignField: "_id", as: "s" },
      },
      { $unwind: { path: "$s", preserveNullAndEmptyArrays: true } },
    ]),
    Overtime.aggregate([
      { $match: base },
      { $group: { _id: "$site", amount: { $sum: "$amount" } } },
      {
        $lookup: { from: Site.collection.name, localField: "_id", foreignField: "_id", as: "s" },
      },
      { $unwind: { path: "$s", preserveNullAndEmptyArrays: true } },
    ]),
  ]);
  const bySite = new Map<string, { name: string; regular: number; ot: number }>();
  for (const r of attendanceRows as Array<{ _id: Types.ObjectId | null; cost: number; s?: { name?: string } }>) {
    const key = r._id ? String(r._id) : "__unassigned";
    const cur = bySite.get(key) ?? { name: r._id ? (r.s?.name ?? "—") : "Unassigned", regular: 0, ot: 0 };
    cur.regular = Math.round(r.cost ?? 0);
    bySite.set(key, cur);
  }
  for (const r of overtimeRows as Array<{ _id: Types.ObjectId | null; amount: number; s?: { name?: string } }>) {
    const key = r._id ? String(r._id) : "__unassigned";
    const cur = bySite.get(key) ?? { name: r._id ? (r.s?.name ?? "—") : "Unassigned", regular: 0, ot: 0 };
    cur.ot = r.amount ?? 0;
    bySite.set(key, cur);
  }
  return [...bySite.entries()]
    .map(([key, v]) => ({
      siteId: key === "__unassigned" ? null : key,
      siteName: v.name,
      regularCost: v.regular,
      otCost: v.ot,
      total: v.regular + v.ot,
    }))
    .sort((a, b) => b.total - a.total);
}

export interface OvertimeRow {
  siteName: string;
  workerName: string;
  hours: number;
  cost: number;
}

export interface OvertimeReport {
  totalHours: number;
  totalCost: number;
  rows: OvertimeRow[];
  monthly: { month: string; hours: number; cost: number }[];
  /**
   * Reconciliation: Σ Overtime.amount vs Σ Salary.overtimeRecordsAmount over the
   * same date scope, plus settlements flagged needsReconciliation. Non-zero drift
   * or flags mean salary was computed before OT edits — recompute, don't adjust.
   */
  reconciliation: { overtimeRecords: number; salaryRecords: number; drift: number; flaggedSettlements: number };
}

/** Overtime report — standalone records reconciled against Salary settlements. */
export async function getOvertimeReport(
  scope?: ReportScope & { labourId?: string },
): Promise<OvertimeReport> {
  const match = {
    ...dateMatch(scope),
    ...idMatch("project", scope?.projectId),
    ...idMatch("site", scope?.siteId),
    ...idMatch("labour", scope?.labourId),
  };
  const [docs, monthlyRows, salaryAgg, flagged] = await Promise.all([
    Overtime.find(match)
      .populate("site", "name")
      .populate("labour", "name")
      .sort({ date: -1 })
      .lean(),
    Overtime.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
          hours: { $sum: "$hours" },
          cost: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Salary.aggregate([
      {
        $match: {
          ...(scope?.from || scope?.to
            ? (() => {
                const dm = dateMatch(scope) as { date?: { $gte: Date; $lte: Date } };
                // Settlement covers the scope when its period overlaps it.
                return {
                  periodStart: { $lte: dm.date?.$lte },
                  periodEnd: { $gte: dm.date?.$gte },
                };
              })()
            : {}),
          ...idMatch("labour", scope?.labourId),
        },
      },
      { $group: { _id: null, amount: { $sum: "$overtimeRecordsAmount" } } },
    ]),
    Salary.countDocuments({ needsReconciliation: true }),
  ]);
  const totalCost = docs.reduce((s: number, o) => s + ((o.amount as number) ?? 0), 0);
  const totalHours = docs.reduce((s: number, o) => s + ((o.hours as number) ?? 0), 0);
  const salaryRecords = salaryAgg[0]?.amount ?? 0;
  const nameOf = (ref: unknown): string =>
    ref && typeof ref === "object" && "name" in ref ? String((ref as { name: unknown }).name) : "—";
  return {
    totalHours: Math.round(totalHours * 10) / 10,
    totalCost,
    rows: docs.map((o: { site?: unknown; labour?: unknown; hours?: unknown; amount?: unknown }) => ({
      siteName: nameOf(o.site),
      workerName: nameOf(o.labour),
      hours: (o.hours as number | undefined) ?? 0,
      cost: (o.amount as number | undefined) ?? 0,
    })),
    monthly: (monthlyRows as Array<{ _id: string; hours: number; cost: number }>).map((m) => ({
      month: m._id,
      hours: Math.round(m.hours * 10) / 10,
      cost: m.cost,
    })),
    reconciliation: {
      overtimeRecords: totalCost,
      salaryRecords,
      drift: totalCost - salaryRecords,
      flaggedSettlements: flagged,
    },
  };
}
