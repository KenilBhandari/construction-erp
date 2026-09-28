/**
 * Canonical report definitions — the single place where every number's meaning
 * is fixed. Domain calculations live in lib/calculations, lib/finance,
 * lib/advances; reports consume them, never duplicate them.
 *
 * HARD RULES (from the Step 0 audit):
 *
 * 1. Labour cost = Attendance.cost (snapshot) + Overtime.amount.
 *    Never aggregate Salary.site / Salary.project — that attribution is
 *    display-only (salary.ts preserves the primary breakdown entry) and will
 *    not reconcile. Salary is summed per worker / per period only.
 *
 * 1b. All OT writes go through lib/overtime.saveOvertime (upsert endpoint +
 *    strict create + by-id edit are wrappers) into Overtime records. OT hours
 *    everywhere = legacy Attendance.overtimeHours + Σ Overtime.hours —
 *    identical sources to the money path (attendanceOT + overtimeRecords),
 *    so row sums always equal header totals. No API path writes the
 *    attendance field anymore; it survives only for pre-existing data.
 *
 * 2. Date bounds reuse dayRange: `from` = 00:00:00 UTC, `to` = through
 *    23:59:59.999 UTC. No per-report date math.
 *
 * 3. Project/site dropdowns exist only on materials + expenses. Labour and
 *    salary reports scope by worker + period.
 *
 * 4. Report formulas never silently differ from Dashboard formulas for the
 *    same concept. If the audit finds the canonical calc wrong, fix the
 *    canonical calc first, then let every consumer inherit the fix.
 */
export const REPORT_DEFINITIONS = {
  labourCost: "Attendance snapshot cost + Overtime record amounts",
  advanceOutstanding: "Total Given − Total Recovered (Salary.advanceRecovery) − Total Written Off",
  salaryBalance: "Σ Salary.net − Σ Salary.paidAmount",
} as const;
