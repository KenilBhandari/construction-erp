/**
 * Business calculations — single source of truth for financial formulas.
 * Keep formulas here, not duplicated in components (ERP_README §61-62).
 */

// --- Salary (§18) ---

export interface SalaryInput {
  presentDays: number;
  halfDays: number;
  dailyRate: number;
  overtimeHours: number;
  overtimeRate: number;
  advanceRecovery: number;
  deductions?: number;
}

/** Present × Daily + Half × Daily × 0.5 */
export function calculateLabourSalary(
  presentDays: number,
  halfDays: number,
  dailyRate: number,
): number {
  return presentDays * dailyRate + halfDays * dailyRate * 0.5;
}

/** Overtime Hours × Overtime Rate */
export function calculateOvertimeAmount(hours: number, rate: number): number {
  return hours * rate;
}

/** Gross + Overtime − AdvanceRecovery − Deductions */
export function calculateNetSalary(input: SalaryInput): {
  gross: number;
  overtimeAmount: number;
  net: number;
} {
  const gross = calculateLabourSalary(
    input.presentDays,
    input.halfDays,
    input.dailyRate,
  );
  const overtimeAmount = calculateOvertimeAmount(
    input.overtimeHours,
    input.overtimeRate,
  );
  const net = gross + overtimeAmount - input.advanceRecovery - (input.deductions ?? 0);
  return { gross, overtimeAmount, net };
}

// --- Project finance (§28, §33-34) ---

/** Material + Labour + Other expenses */
export function calculateProjectExpense(parts: {
  material: number;
  labour: number;
  other: number;
}): number {
  return parts.material + parts.labour + parts.other;
}

/** Contract Value − Received */
export function calculatePendingPayment(
  contractValue: number,
  received: number,
): number {
  return contractValue - received;
}

/** Contract Value − Actual Expense + margin % */
export function calculateProjectProfit(
  contractValue: number,
  totalExpense: number,
): { profit: number; margin: number } {
  const profit = contractValue - totalExpense;
  const margin = contractValue > 0 ? (profit / contractValue) * 100 : 0;
  return { profit, margin };
}
