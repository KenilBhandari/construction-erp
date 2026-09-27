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
 * 2. Global profit ≠ Σ project profits unless the General bucket is included.
 *    Records with null project (general manual expenses, unassigned labour,
 *    unattributed purchases) are surfaced explicitly via getUnattributedCosts.
 *    Invariant: global = Σ named projects + General.
 *
 * 3. Date bounds reuse dayRange: `from` = 00:00:00 UTC, `to` = through
 *    23:59:59.999 UTC. No per-report date math.
 *
 * 4. Estimated Stock Value = currentStock × valuation rate, where the rate is
 *    defaultPurchaseRate, else the most recent recorded purchase rate, else
 *    unavailable (₹0). Never labelled "Stock Value" — no FIFO/average-cost
 *    implication. The rate source travels in the DTO.
 *
 * 5. Purchase-vs-consumption variance is shown only when the data model
 *    supports the comparison: lifetime flows with NO project/site filter
 *    (stock is global per material). Scoped views show flows, never variance.
 *
 * 6. Cash Flow is historical movement only — never "Forecast". Receivables
 *    carry no aging buckets (no due-date field exists).
 *
 * 7. Report formulas never silently differ from Dashboard formulas for the
 *    same concept. If the audit finds the canonical calc wrong, fix the
 *    canonical calc first, then let every consumer inherit the fix.
 */
export const REPORT_DEFINITIONS = {
  profit: "Contract Value − Recorded Project Costs (purchases + attendance labour + overtime + manual expenses)",
  pending: "Contract Value − Recorded Client Payments",
  labourCost: "Attendance snapshot cost + Overtime record amounts",
  advanceOutstanding: "Total Given − Total Recovered (Salary.advanceRecovery) − Total Written Off",
  salaryBalance: "Σ Salary.net − Σ Salary.paidAmount",
  estimatedStockValue: "Current Stock × valuation rate (default rate → last purchase rate → unavailable)",
  cashFlow: "Historical ClientPayment inflow vs SalaryPayment + purchase + Expense outflow",
} as const;
