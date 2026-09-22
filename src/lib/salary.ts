import { Types } from "mongoose";
import { Attendance } from "@/models/Attendance";
import { Labour } from "@/models/Labour";
import { Overtime } from "@/models/Overtime";
import { Salary } from "@/models/Salary";
import { Site } from "@/models/Site";
import {
  calculateLabourSalary,
  calculateOvertimeAmount,
} from "@/lib/calculations";
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
 * Called (best-effort) after attendance/overtime writes so stored
 * pay figures never go stale. Advances no longer trigger recompute.
 */
export async function recomputeSalariesFor(labourIds: string[], date: Date | string) {
  const day = toDayDate(date);
  for (const labourId of [...new Set(labourIds)]) {
    const affected = await Salary.find({
      labour: new Types.ObjectId(labourId),
      periodStart: { $lte: day },
      periodEnd: { $gte: day },
    })
      .select("periodStart periodEnd")
      .lean();
    for (const s of affected) {
      await computeAndSaveSalary({
        labourId,
        periodStart: s.periodStart.toISOString().slice(0, 10),
        periodEnd: s.periodEnd.toISOString().slice(0, 10),
      });
    }
  }
}

interface ComputeInput {
  labourId: string;
  periodStart: string;
  periodEnd: string;
  advanceRecovery?: number;
  site?: string | null;
  project?: string | null;
  notes?: string | null;
}

/**
 * Aggregate attendance + overtime for the period and upsert the Salary record.
 * advanceRecovery is explicit contractor-chosen recovery, validated against
 * outstanding (computed from LabourAdvance - Salary recoveries - write-offs).
 * Advances by date no longer auto-deduct; site/project stored for attribution.
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

  const existing = await Salary.findOne({
    labour: labourFilter.labour,
    periodStart: start,
    periodEnd: endDate,
  }).lean();

  // Resolve site/project attribution: validate site.project matches supplied project.
  let siteOid: Types.ObjectId | null = null;
  let projectOid: Types.ObjectId | null = null;

  if (input.site !== undefined) {
    // Explicit site supplied (null = clear)
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
      // site explicitly null — project may still be supplied independently
      if (input.project) {
        if (!Types.ObjectId.isValid(input.project)) throw new Error("Invalid project id.");
        projectOid = new Types.ObjectId(input.project);
      }
    }
  } else if (input.project !== undefined) {
    // No site change, but project supplied alone
    if (input.project) {
      if (!Types.ObjectId.isValid(input.project)) throw new Error("Invalid project id.");
      projectOid = new Types.ObjectId(input.project);
    }
  } else {
    // Neither supplied — preserve existing attribution
    if (existing?.site) siteOid = existing.site as Types.ObjectId;
    if (existing?.project) projectOid = existing.project as Types.ObjectId;
  }

  const [attendanceAgg, overtimeAgg] = await Promise.all([
    Attendance.aggregate([
      { $match: { ...labourFilter, date: dateFilter } },
      {
        $group: {
          _id: "$status",
          days: { $sum: 1 },
          ot: { $sum: "$overtimeHours" },
        },
      },
    ]),
    Overtime.aggregate([
      { $match: { ...labourFilter, date: dateFilter } },
      { $group: { _id: null, amount: { $sum: "$amount" } } },
    ]),
  ]);

  const byStatus: Record<string, { days: number; ot: number }> = {};
  for (const row of attendanceAgg as { _id: string; days: number; ot: number }[]) {
    byStatus[row._id] = row;
  }
  const presentDays = byStatus.present?.days ?? 0;
  const halfDays = byStatus["half-day"]?.days ?? 0;
  const absentDays = byStatus.absent?.days ?? 0;
  const leaveDays = byStatus.leave?.days ?? 0;
  const overtimeHours = attendanceAgg.reduce(
    (sum: number, r: { ot: number }) => sum + (r.ot ?? 0),
    0,
  );

  const gross = calculateLabourSalary(presentDays, halfDays, labour.dailyRate);
  const attendanceOT = calculateOvertimeAmount(overtimeHours, labour.hourlyRate);
  const overtimeRecordsAmount = (overtimeAgg[0]?.amount as number | undefined) ?? 0;
  const overtimeAmount = attendanceOT + overtimeRecordsAmount;

  // Explicit recovery handling
  const requestedRecovery =
    input.advanceRecovery !== undefined
      ? input.advanceRecovery
      : (existing?.advanceRecovery ?? 0);

  if (requestedRecovery < 0) throw new Error("Advance recovery cannot be negative.");

  // Validate against outstanding: editing must not count its own previous recovery.
  const summary = await getLabourAdvanceSummary(input.labourId);
  const existingRecovery = existing?.advanceRecovery ?? 0;
  const available = summary.outstanding + existingRecovery;
  if (requestedRecovery > available) {
    throw new Error(
      `Advance recovery ₹${requestedRecovery.toLocaleString("en-IN")} exceeds outstanding ₹${available.toLocaleString("en-IN")}. Outstanding is ₹${summary.outstanding.toLocaleString("en-IN")} (given ₹${summary.totalGiven.toLocaleString("en-IN")} − recovered ₹${summary.totalRecovered.toLocaleString("en-IN")} − written off ₹${summary.totalWrittenOff.toLocaleString("en-IN")}).`,
    );
  }

  const deductions = existing?.deductions ?? 0;
  const paidAmount = existing?.paidAmount ?? 0;
  const advanceRecovery = requestedRecovery;
  const net = gross + overtimeAmount - advanceRecovery - deductions;
  const status = deriveSalaryStatus(net, paidAmount);

  return Salary.findOneAndUpdate(
    {
      labour: labourFilter.labour,
      periodStart: start,
      periodEnd: endDate,
    },
    {
      $set: {
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
        status,
        notes: input.notes ?? existing?.notes ?? null,
      },
    },
    { upsert: true, new: true, runValidators: true },
  ).lean();
}
