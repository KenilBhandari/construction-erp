export const SALARY_STATUSES = ["pending", "partially-paid", "paid"] as const;

export type SalaryStatus = (typeof SALARY_STATUSES)[number];

export interface SalaryDTO {
  _id: string;
  labour: string | { _id: string; name: string };
  site: string | { _id: string; name: string } | null;
  project: string | { _id: string; name: string } | null;
  periodStart: string;
  periodEnd: string;
  presentDays: number;
  halfDays: number;
  absentDays: number;
  leaveDays: number;
  overtimeHours: number;
  overtimeRecordsAmount: number;
  gross: number;
  overtimeAmount: number;
  /** Canonical explicit recovery for this settlement (contractor-chosen). */
  advanceRecovery: number;
  /** @deprecated — legacy alias kept for compat, equals advanceRecovery. */
  advances: number;
  deductions: number;
  net: number;
  paidAmount: number;
  paymentMethod: string | null;
  paymentReference: string | null;
  status: SalaryStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export function salaryLabourName(s: SalaryDTO): string {
  return typeof s.labour === "string" ? s.labour : s.labour.name;
}

export interface AdvanceDTO {
  _id: string;
  labour: string | { _id: string; name: string };
  site: string | { _id: string; name: string } | null;
  project: string | { _id: string; name: string } | null;
  date: string;
  amount: number;
  reason: string | null;
  paymentMethod: string | null;
  reference: string | null;
  notes: string | null;
}

export function advanceLabourName(a: AdvanceDTO): string {
  return typeof a.labour === "string" ? a.labour : a.labour.name;
}

export function advanceSiteName(a: AdvanceDTO): string | null {
  if (!a.site) return null;
  return typeof a.site === "string" ? a.site : a.site.name;
}
