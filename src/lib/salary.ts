import { Types } from "mongoose";
import { Attendance } from "@/models/Attendance";
import { Labour } from "@/models/Labour";
import { LabourAdvance } from "@/models/LabourAdvance";
import { Overtime } from "@/models/Overtime";
import { Salary } from "@/models/Salary";
import {
  calculateLabourSalary,
  calculateOvertimeAmount,
} from "@/lib/calculations";
import { dayRange, toDayDate } from "@/lib/utils";
import type { SalaryStatus } from "@/types/salary";

/** Paid in full → paid; anything paid → partially-paid; else pending. */
export function deriveSalaryStatus(net: number, paidAmount: number): SalaryStatus {
  if (paidAmount >= net) return "paid";
  if (paidAmount > 0) return "partially-paid";
  return "pending";
}

/**
 * Recompute every salary period containing `date` for the given workers.
 * Called (best-effort) after attendance/overtime/advance writes so stored
 * pay figures never go stale. Callers must not fail their own write if
 * this throws — wrap in try/catch and warn.
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
  notes?: string | null;
}

/**
 * Aggregate attendance + overtime + advances for the period and upsert the
 * Salary record. Paid amount and deductions survive recomputation.
 */
export async function computeAndSaveSalary(input: ComputeInput) {
  if (input.periodStart > input.periodEnd) {
    throw new Error("Period start must be on or before period end.");
  }

  const labour = await Labour.findById(input.labourId).lean();
  if (!labour) throw new Error("Worker not found.");

  const start = toDayDate(input.periodStart);
  const { start: rangeStart, end: rangeEnd } = dayRange(
    input.periodStart,
    input.periodEnd,
  );
  const dateFilter = { $gte: rangeStart, $lte: rangeEnd };
  const labourFilter = { labour: new Types.ObjectId(input.labourId) };

  const [attendanceAgg, overtimeAgg, advancesAgg, existing] = await Promise.all([
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
    LabourAdvance.aggregate([
      { $match: { ...labourFilter, date: dateFilter } },
      { $group: { _id: null, amount: { $sum: "$amount" } } },
    ]),
    Salary.findOne({
      labour: labourFilter.labour,
      periodStart: start,
      periodEnd: toDayDate(input.periodEnd),
    }).lean(),
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
  const advances = (advancesAgg[0]?.amount as number | undefined) ?? 0;
  const deductions = existing?.deductions ?? 0;
  const paidAmount = existing?.paidAmount ?? 0;
  const net = gross + overtimeAmount - advances - deductions;
  const status = deriveSalaryStatus(net, paidAmount);

  return Salary.findOneAndUpdate(
    {
      labour: labourFilter.labour,
      periodStart: start,
      periodEnd: toDayDate(input.periodEnd),
    },
    {
      $set: {
        presentDays,
        halfDays,
        absentDays,
        leaveDays,
        overtimeHours,
        overtimeRecordsAmount,
        gross,
        overtimeAmount,
        advances,
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
