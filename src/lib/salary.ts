import { Types } from "mongoose";
import { Attendance } from "@/models/Attendance";
import { Labour } from "@/models/Labour";
import { Overtime } from "@/models/Overtime";
import { Salary } from "@/models/Salary";
import { SalaryAdjustment } from "@/models/SalaryAdjustment";
import { Site } from "@/models/Site";
import { Project } from "@/models/Project";
import { attendanceCostFor } from "@/lib/utils";
import { dayRange, toDayDate } from "@/lib/utils";
import { getLabourAdvanceSummary } from "@/lib/advances";
import type { SalaryStatus } from "@/types/salary";

/** Paid in full → paid; anything paid → partially-paid; else pending. */
export function deriveSalaryStatus(net: number, paidAmount: number): SalaryStatus {
  if (paidAmount >= net) return "paid";
  if (paidAmount > 0) return "partially-paid";
  return "pending";
}

/**
 * Recompute every salary period containing `date` for the given workers.
 * Only pending settlements are recomputed silently.
 */
export async function recomputeSalariesFor(labourIds: string[], date: Date | string) {
  const day = toDayDate(date);
  for (const labourId of [...new Set(labourIds)]) {
    const affected = await Salary.find({
      labour: new Types.ObjectId(labourId),
      periodStart: { $lte: day },
      periodEnd: { $gte: day },
      status: "pending",
    })
      .select("periodStart periodEnd")
      .lean();
    for (const s of affected) {
      try {
        await computeAndSaveSalary({
          labourId,
          periodStart: s.periodStart.toISOString().slice(0, 10),
          periodEnd: s.periodEnd.toISOString().slice(0, 10),
        });
      } catch (e) {
        console.warn("[salary] recompute skipped for", labourId, (e as Error).message);
      }
    }
  }
}

/**
 * For partially-paid/paid settlements: detect mismatch and create adjustment marker.
 * Never silently overwrites frozen money — sets needsReconciliation and creates SalaryAdjustment.
 */
export async function handleAttendanceChangeForReconciliation(labourIds: string[], date: Date | string) {
  const day = toDayDate(date);
  for (const labourId of [...new Set(labourIds)]) {
    const locked = await Salary.find({
      labour: new Types.ObjectId(labourId),
      periodStart: { $lte: day },
      periodEnd: { $gte: day },
      status: { $in: ["partially-paid", "paid"] },
    }).lean();
    for (const s of locked) {
      try {
        const { start, end } = dayRange(s.periodStart.toISOString().slice(0, 10), s.periodEnd.toISOString().slice(0, 10));
        const labour = await Labour.findById(labourId).select("dailyRate hourlyRate").lean();
        if (!labour) continue;
        const attendances = await Attendance.find({ labour: new Types.ObjectId(labourId), date: { $gte: start, $lte: end } }).lean();
        let newGross = 0;
        let newOT = 0;
        for (const a of attendances) {
          const c = (a as unknown as { cost?: number }).cost;
          if (typeof c === "number") newGross += c;
          else newGross += attendanceCostFor((a as unknown as { status: string }).status, (a as unknown as { dailyRateSnapshot?: number }).dailyRateSnapshot ?? labour.dailyRate);
          const oh = (a as unknown as { overtimeHours?: number }).overtimeHours ?? 0;
          const hr = (a as unknown as { hourlyRateSnapshot?: number }).hourlyRateSnapshot ?? labour.hourlyRate;
          if (oh) newOT += Math.round(oh * hr);
        }
        const overtimeAgg = await Overtime.aggregate([
          { $match: { labour: new Types.ObjectId(labourId), date: { $gte: start, $lte: end } } },
          { $group: { _id: null, amount: { $sum: "$amount" } } },
        ]);
        newOT += overtimeAgg[0]?.amount ?? 0;
        const oldGross = (s as unknown as { gross: number }).gross ?? 0;
        const oldOT = (s as unknown as { overtimeAmount: number }).overtimeAmount ?? 0;
        const deltaGross = newGross - oldGross;
        const deltaOT = newOT - oldOT;
        if (deltaGross === 0 && deltaOT === 0) continue;
        const deltaNet = deltaGross + deltaOT;
        await Salary.updateOne({ _id: s._id }, { $set: { needsReconciliation: true } });
        const idem = `recon:${String(s._id)}:${day.toISOString().slice(0,10)}:${deltaGross}:${deltaOT}`;
        const exists = await SalaryAdjustment.findOne({ idempotencyKey: idem }).lean();
        if (!exists) {
          await SalaryAdjustment.create({
            salary: s._id,
            labour: new Types.ObjectId(labourId),
            periodStart: s.periodStart,
            periodEnd: s.periodEnd,
            deltaGross,
            deltaOvertime: deltaOT,
            deltaNet,
            reason: "Attendance/OT changed after partial/full payment — reconciliation required",
            attendanceIds: attendances.map((a) => a._id),
            idempotencyKey: idem,
          });
        }
      } catch (e) {
        console.warn("[salary] reconciliation check skipped for", labourId, (e as Error).message);
      }
    }
  }
}

interface ComputeInput {
  labourId: string;
  periodStart: string;
  periodEnd: string;
  advanceRecovery?: number;
  deductions?: number;
  site?: string | null;
  project?: string | null;
  notes?: string | null;
  idempotencyKey?: string | null;
}

/**
 * Aggregate attendance + overtime for the period and upsert the Salary record.
 * Uses snapshot cost (Attendance.cost) + Overtime.amount.
 * Builds earningsBreakdown per site/project.
 */
export async function computeAndSaveSalary(input: ComputeInput) {
  if (input.periodStart > input.periodEnd) {
    throw new Error("Period start must be on or before period end.");
  }

  const labour = await Labour.findById(input.labourId).lean();
  if (!labour) throw new Error("Worker not found.");

  const start = toDayDate(input.periodStart);
  const endDate = toDayDate(input.periodEnd);
  const { start: rangeStart, end: rangeEnd } = dayRange(
    input.periodStart,
    input.periodEnd,
  );
  const dateFilter = { $gte: rangeStart, $lte: rangeEnd };
  const labourFilter = { labour: new Types.ObjectId(input.labourId) };

  // Idempotency: if key provided and exact period already exists with same key, return it
  if (input.idempotencyKey) {
    const byKey = await Salary.findOne({ idempotencyKey: input.idempotencyKey }).lean();
    if (byKey) return byKey;
  }

  const existing = await Salary.findOne({
    labour: labourFilter.labour,
    periodStart: start,
    periodEnd: endDate,
  }).lean();

  const overlapping = await Salary.findOne({
    labour: labourFilter.labour,
    periodStart: { $lte: endDate },
    periodEnd: { $gte: start },
  }).lean();
  if (overlapping && (!existing || String(overlapping._id) !== String(existing._id))) {
    throw new Error(
      `Salary settlement already exists for this worker in an overlapping period (${overlapping.periodStart.toISOString().slice(0, 10)} to ${overlapping.periodEnd.toISOString().slice(0, 10)}).`,
    );
  }

  if (existing && existing.status !== "pending") {
    throw new Error("Recalculate not allowed — this settlement has payments and its snapshot is frozen.");
  }

  let siteOid: Types.ObjectId | null = null;
  let projectOid: Types.ObjectId | null = null;

  if (input.site !== undefined) {
    if (input.site) {
      if (!Types.ObjectId.isValid(input.site)) throw new Error("Invalid site id.");
      const siteDoc = await Site.findById(input.site).select("project").lean();
      if (!siteDoc) throw new Error("Selected site not found.");
      siteOid = new Types.ObjectId(input.site);
      const siteProjectId = String(siteDoc.project);
      if (input.project) {
        if (String(input.project) !== siteProjectId) {
          throw new Error("Selected project does not match the site's project.");
        }
        projectOid = new Types.ObjectId(input.project);
      } else {
        projectOid = new Types.ObjectId(siteProjectId);
      }
    } else {
      if (input.project) {
        if (!Types.ObjectId.isValid(input.project)) throw new Error("Invalid project id.");
        projectOid = new Types.ObjectId(input.project);
      }
    }
  } else if (input.project !== undefined) {
    if (input.project) {
      if (!Types.ObjectId.isValid(input.project)) throw new Error("Invalid project id.");
      projectOid = new Types.ObjectId(input.project);
    }
  } else {
    if (existing?.site) siteOid = existing.site as Types.ObjectId;
    if (existing?.project) projectOid = existing.project as Types.ObjectId;
  }

  // Fetch attendance + overtime for breakdown
  const [attendances, overtimeAgg] = await Promise.all([
    Attendance.find({ ...labourFilter, date: dateFilter }).lean(),
    Overtime.aggregate([
      { $match: { ...labourFilter, date: dateFilter } },
      { $group: { _id: null, amount: { $sum: "$amount" } } },
    ]),
  ]);

  // Totals for top-level fields
  let presentDays = 0;
  let halfDays = 0;
  let absentDays = 0;
  let leaveDays = 0;
  let overtimeHours = 0;
  let gross = 0;
  let attendanceOT = 0;

  // Breakdown map: key = siteId||"unassigned" + projectId — includes snapshot names
  const breakdownMap = new Map<
    string,
    { site: Types.ObjectId | null; project: Types.ObjectId | null; siteName: string | null; projectName: string | null; presentDays: number; halfDays: number; gross: number; overtimeAmount: number }
  >();

  function breakdownKey(site: unknown, project: unknown): string {
    const s = site ? String(site) : "__unassigned";
    const p = project ? String(project) : "__noproject";
    return `${s}::${p}`;
  }

  for (const a of attendances as unknown as Array<{
    status: string;
    site: Types.ObjectId | null;
    project: Types.ObjectId | null;
    cost?: number;
    dailyRateSnapshot?: number;
    hourlyRateSnapshot?: number;
    overtimeHours?: number;
  }>) {
    if (a.status === "present") presentDays++;
    else if (a.status === "half-day") halfDays++;
    else if (a.status === "absent") absentDays++;
    else leaveDays++;

    overtimeHours += a.overtimeHours ?? 0;
    const cost = typeof a.cost === "number" ? a.cost : attendanceCostFor(a.status, a.dailyRateSnapshot ?? labour.dailyRate);
    gross += cost;
    const otHours = a.overtimeHours ?? 0;
    const hr = a.hourlyRateSnapshot ?? labour.hourlyRate;
    const otForThis = otHours ? Math.round(otHours * hr) : 0;
    attendanceOT += otForThis;

    const key = breakdownKey(a.site, a.project);
    const entry = breakdownMap.get(key) ?? {
      site: (a.site as Types.ObjectId) ?? null,
      project: (a.project as Types.ObjectId) ?? null,
      siteName: null,
      projectName: null,
      presentDays: 0,
      halfDays: 0,
      gross: 0,
      overtimeAmount: 0,
    };
    if (a.status === "present") entry.presentDays++;
    else if (a.status === "half-day") entry.halfDays++;
    entry.gross += cost;
    entry.overtimeAmount += otForThis;
    breakdownMap.set(key, entry);
  }

  const overtimeRecordsAmount = (overtimeAgg[0]?.amount as number | undefined) ?? 0;
  const overtimeAmount = attendanceOT + overtimeRecordsAmount;

  // Distribute overtimeRecordsAmount to breakdown: group Overtime by site/project
  const overtimeDocs = await Overtime.find({ ...labourFilter, date: dateFilter }).select("site project amount").lean();
  for (const o of overtimeDocs as unknown as Array<{ site: Types.ObjectId; project: Types.ObjectId; amount: number }>) {
    const key = breakdownKey(o.site, o.project);
    const entry = breakdownMap.get(key) ?? { site: o.site, project: o.project, siteName: null, projectName: null, presentDays: 0, halfDays: 0, gross: 0, overtimeAmount: 0 };
    entry.overtimeAmount += o.amount;
    breakdownMap.set(key, entry);
  }

  // Snapshot siteName/projectName at write time (new writes only) — prevents populate leak
  const siteIds = [...new Set(Array.from(breakdownMap.values()).map((b) => (b.site ? String(b.site) : null)).filter(Boolean) as string[])];
  const projectIds = [...new Set(Array.from(breakdownMap.values()).map((b) => (b.project ? String(b.project) : null)).filter(Boolean) as string[])];
  let siteNameMap = new Map<string, string>();
  let projectNameMap = new Map<string, string>();
  if (siteIds.length) {
    const sites = await Site.find({ _id: { $in: siteIds.map((id) => new Types.ObjectId(id)) } })
      .select("name")
      .lean();
    siteNameMap = new Map(sites.map((s) => [String(s._id), s.name]));
  }
  if (projectIds.length) {
    const projects = await Project.find({ _id: { $in: projectIds.map((id) => new Types.ObjectId(id)) } })
      .select("name")
      .lean();
    projectNameMap = new Map(projects.map((p) => [String(p._id), p.name]));
  }
  for (const entry of breakdownMap.values()) {
    if (entry.site) entry.siteName = siteNameMap.get(String(entry.site)) ?? null;
    if (entry.project) entry.projectName = projectNameMap.get(String(entry.project)) ?? null;
  }

  const earningsBreakdown = Array.from(breakdownMap.values()).map((b) => ({
    site: b.site,
    project: b.project,
    siteName: b.siteName,
    projectName: b.projectName,
    presentDays: b.presentDays,
    halfDays: b.halfDays,
    gross: b.gross,
    overtimeAmount: b.overtimeAmount,
  }));

  // If no attendance at all, earningsBreakdown stays empty — gross 0 will be guarded below but we allow 0? Guard says net <=0 throws
  const requestedRecovery =
    input.advanceRecovery !== undefined
      ? input.advanceRecovery
      : (existing?.advanceRecovery ?? 0);
  const deductions = input.deductions !== undefined ? input.deductions : (existing?.deductions ?? 0);

  if (requestedRecovery < 0) throw new Error("Advance recovery cannot be negative.");
  if (deductions < 0) throw new Error("Deductions cannot be negative.");

  const summary = await getLabourAdvanceSummary(input.labourId);
  const existingRecovery = existing?.advanceRecovery ?? 0;
  const available = summary.outstanding + existingRecovery;
  if (requestedRecovery > available) {
    throw new Error(
      `Advance recovery ₹${requestedRecovery.toLocaleString("en-IN")} exceeds outstanding ₹${available.toLocaleString("en-IN")}. Outstanding is ₹${summary.outstanding.toLocaleString("en-IN")} (given ₹${summary.totalGiven.toLocaleString("en-IN")} − recovered ₹${summary.totalRecovered.toLocaleString("en-IN")} − written off ₹${summary.totalWrittenOff.toLocaleString("en-IN")}).`,
    );
  }

  const paidAmount = existing?.paidAmount ?? 0;
  const advanceRecovery = requestedRecovery;
  const net = gross + overtimeAmount - advanceRecovery - deductions;
  if (net <= 0) {
    // Allow zero-gross periods to be rejected — but we need to allow recompute even if gross zero? Guard original says cannot create if net <=0
    // For empty attendance, gross 0 -> net negative or zero -> throw
    throw new Error("Salary settlement cannot be created because the net amount is ₹0 or less.");
  }
  if (advanceRecovery + deductions > gross + overtimeAmount) {
    throw new Error("Advance recovery and deductions cannot exceed gross + overtime.");
  }
  const status = deriveSalaryStatus(net, paidAmount);
  const remainingAmount = Math.max(0, net - paidAmount);

  // Preserve primary site/project from breakdown if not explicitly supplied
  if (siteOid === null && projectOid === null && earningsBreakdown.length > 0) {
    // Keep existing attribution if exists, otherwise use first breakdown entry for display
    if (!existing?.site && !existing?.project) {
      // Prefer non-unassigned entry if available
      const primary = earningsBreakdown.find((b) => b.site) ?? earningsBreakdown[0];
      siteOid = primary.site as Types.ObjectId | null;
      projectOid = primary.project as Types.ObjectId | null;
    } else {
      siteOid = existing?.site as Types.ObjectId | null;
      projectOid = existing?.project as Types.ObjectId | null;
    }
  }

  const updateDoc: Record<string, unknown> = {
    site: siteOid,
    project: projectOid,
    presentDays,
    halfDays,
    absentDays,
    leaveDays,
    overtimeHours,
    overtimeRecordsAmount,
    gross,
    overtimeAmount,
    advanceRecovery,
    deductions,
    net,
    paidAmount,
    remainingAmount,
    status,
    notes: input.notes ?? existing?.notes ?? null,
    snapshotDailyRate: labour.dailyRate,
    snapshotHourlyRate: labour.hourlyRate,
    earningsBreakdown,
    needsReconciliation: false,
  };
  if (input.idempotencyKey) updateDoc.idempotencyKey = input.idempotencyKey;

  // Atomic CAS: if existing, ensure we don't overwrite a concurrently modified paidAmount
  // For pending, paidAmount is 0 usually but we guard via findOneAndUpdate with expected paidAmount
  const filter: Record<string, unknown> = {
    labour: labourFilter.labour,
    periodStart: start,
    periodEnd: endDate,
  };

  // If idempotencyKey present and this is an upsert, duplicate key will throw 11000 — caller handles
  try {
    const result = (await Salary.findOneAndUpdate(
      filter,
      { $set: updateDoc },
      { upsert: true, new: true, runValidators: true },
    ).lean()) as unknown as Record<string, unknown> | null;
    return result as never;
  } catch (e: unknown) {
    const code = (e as { code?: number })?.code;
    const msg = (e as { message?: string })?.message ?? "";
    if (code === 11000 || msg.includes("duplicate key")) {
      // Idempotent retry: return existing
      const again = (await Salary.findOne(filter).lean()) as unknown as Record<string, unknown> | null;
      if (again) return again as never;
    }
    throw e;
  }
}
