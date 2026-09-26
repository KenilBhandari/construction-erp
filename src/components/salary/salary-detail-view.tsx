"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { formatDateShort, safeINR, toSafeNumber } from "@/lib/utils";
import type { SalaryDTO, SalaryAdjustmentDTO } from "@/types/salary";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  "partially-paid": "Partially Paid",
  paid: "Paid",
};

interface PaymentDTO {
  _id: string;
  amount: number;
  date: string;
  paymentMethod: string;
  reference: string | null;
  notes: string | null;
  createdAt: string;
}

export function SalaryDetailView({ salaryId, open, onClose }: { salaryId: string; open: boolean; onClose: () => void }) {
  const [salary, setSalary] = useState<SalaryDTO | null>(null);
  const [payments, setPayments] = useState<PaymentDTO[]>([]);
  const [adjustments, setAdjustments] = useState<SalaryAdjustmentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !salaryId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/salary/${salaryId}`).then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Failed to load salary.");
        return j as SalaryDTO;
      }),
      fetch(`/api/salary/${salaryId}/payments`).then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Failed to load payments.");
        return (j.payments as PaymentDTO[]) ?? [];
      }),
      fetch(`/api/salary/${salaryId}/adjustments`).then(async (r) => {
        const j = await r.json();
        if (!r.ok) return [];
        return (j.adjustments as SalaryAdjustmentDTO[]) ?? [];
      }),
    ])
      .then(([s, p, a]) => {
        setSalary(s);
        setPayments(p);
        setAdjustments(a);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [open, salaryId]);

  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} size="xl" title="Salary Detail">
      {loading && <p className="text-sm text-text-muted">Loading…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      {!loading && !error && salary && (
        <div className="flex flex-col gap-5">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-base font-semibold text-text">{typeof salary.labour === "string" ? salary.labour : salary.labour.name}</p>
              <p className="mt-0.5 text-sm text-text-muted tnum">{formatDateShort(salary.periodStart)} – {formatDateShort(salary.periodEnd)} · {toSafeNumber(salary.presentDays)}P / {toSafeNumber(salary.halfDays)}H · {toSafeNumber(salary.overtimeHours)} OT hrs</p>
            </div>
            <div className="flex items-center gap-2">
              {salary.status !== "pending" && <span className="text-xs text-text-muted">Locked</span>}
              <Badge tone={salary.status === "paid" ? "success" : salary.status === "partially-paid" ? "warning" : "neutral"}>{STATUS_LABEL[salary.status]}</Badge>
            </div>
          </div>
          {salary.needsReconciliation && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-warning">Needs reconciliation — attendance changed after payment.</p>}

          {/* Hero summary */}
          <Card className="p-4">
            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div><dt className="text-sm text-text-muted">Net payable</dt><dd className="mt-0.5 font-semibold tnum text-warning">{safeINR(salary.net)}</dd></div>
              <div><dt className="text-sm text-text-muted">Paid</dt><dd className="mt-0.5 font-medium tnum">{safeINR(salary.paidAmount)}</dd></div>
              <div><dt className="text-sm text-text-muted">Remaining</dt><dd className="mt-0.5 font-medium tnum">{safeINR(salary.remainingAmount)}</dd></div>
            </dl>
            <dl className="mt-3 grid grid-cols-3 gap-3 border-t border-border pt-3 text-sm sm:grid-cols-5">
              <div><dt className="text-xs text-text-muted">Attendance</dt><dd className={`mt-0.5 tnum ${toSafeNumber(salary.gross) > 0 ? "font-semibold" : "text-text-muted"}`}>{safeINR(salary.gross)}</dd></div>
              <div><dt className="text-xs text-text-muted">Overtime</dt><dd className={`mt-0.5 tnum ${toSafeNumber(salary.overtimeAmount) > 0 ? "font-semibold" : "text-text-muted"}`}>{safeINR(salary.overtimeAmount)}</dd></div>
              <div><dt className="text-xs text-text-muted">Gross</dt><dd className="mt-0.5 font-semibold tnum">{safeINR(toSafeNumber(salary.gross) + toSafeNumber(salary.overtimeAmount))}</dd></div>
              <div><dt className="text-xs text-text-muted">Recovery</dt><dd className={`mt-0.5 tnum ${toSafeNumber(salary.advanceRecovery) > 0 ? "font-semibold" : "text-text-muted"}`}>{safeINR(salary.advanceRecovery)}</dd></div>
              <div><dt className="text-xs text-text-muted">Deductions</dt><dd className={`mt-0.5 tnum ${toSafeNumber(salary.deductions) > 0 ? "font-semibold" : "text-text-muted"}`}>{safeINR(salary.deductions)}</dd></div>
            </dl>
          </Card>

          {/* Earnings breakdown */}
          <div>
            <h3 className="text-sm font-medium text-text">Earnings breakdown{salary.earningsBreakdown && salary.earningsBreakdown.length > 0 ? <span className="ml-1 font-normal text-text-muted">· {salary.earningsBreakdown.length} sites</span> : null}</h3>
            {!salary.earningsBreakdown || salary.earningsBreakdown.length === 0 ? (
              <p className="mt-2 text-sm text-text-muted">No breakdown — single-site total.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <Table>
                  <THead><TR><TH>Site</TH><TH>Project</TH><TH numeric>Present/Half</TH><TH numeric>Gross</TH><TH numeric>OT</TH><TH numeric>Total</TH></TR></THead>
                  <tbody>
                    {salary.earningsBreakdown.map((b, idx) => {
                      const siteName = b.siteName ?? (b.site && typeof b.site === "object" && "name" in b.site ? (b.site as { name: string }).name : null) ?? "Unassigned";
                      const projectName = b.projectName ?? (b.project && typeof b.project === "object" && "name" in b.project ? (b.project as { name: string }).name : null) ?? "—";
                      const total = toSafeNumber(b.gross) + toSafeNumber(b.overtimeAmount);
                      return (
                        <TR key={idx}>
                          <TD><span className={siteName === "Unassigned" ? "italic text-text-muted" : "font-medium"}>{siteName}</span></TD>
                          <TD>{projectName}</TD>
                          <TD numeric>{toSafeNumber(b.presentDays)}/{toSafeNumber(b.halfDays)}</TD>
                          <TD numeric>{safeINR(b.gross)}</TD>
                          <TD numeric>{safeINR(b.overtimeAmount)}</TD>
                          <TD numeric><span className="font-semibold">{safeINR(total)}</span></TD>
                        </TR>
                      );
                    })}
                    <TR key="total" className="bg-background/50 text-sm">
                      <TD colSpan={3} className="text-right text-text-muted">Total</TD>
                      <TD numeric>{safeINR(salary.gross)}</TD>
                      <TD numeric>{safeINR(salary.overtimeAmount)}</TD>
                      <TD numeric><span className="font-semibold">{safeINR(toSafeNumber(salary.gross) + toSafeNumber(salary.overtimeAmount))}</span></TD>
                    </TR>
                  </tbody>
                </Table>
              </div>
            )}
          </div>

          {/* Payments */}
          <div>
            <h3 className="text-sm font-medium text-text">Payments{payments.length > 0 ? <span className="ml-1 font-normal text-text-muted">· {payments.length}</span> : null}</h3>
            {payments.length === 0 ? (
              <p className="mt-2 text-sm text-text-muted">No payments yet.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <Table>
                  <THead><TR><TH>Date</TH><TH numeric>Amount</TH><TH>Method</TH><TH>Reference</TH><TH>Notes</TH></TR></THead>
                  <tbody>
                    {payments.map((p) => (
                      <TR key={p._id}>
                        <TD className="tnum">{formatDateShort(p.date)}</TD>
                        <TD numeric><span className="font-medium">{safeINR(p.amount)}</span></TD>
                        <TD>{p.paymentMethod ?? "—"}</TD>
                        <TD className="tnum">{p.reference ?? "—"}</TD>
                        <TD className="max-w-[180px] truncate" title={p.notes ?? ""}>{p.notes ?? "—"}</TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </div>

          {/* Adjustments */}
          {adjustments.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-text">Adjustments{<span className="ml-1 font-normal text-text-muted">· {adjustments.length}</span>}</h3>
              <div className="mt-2 overflow-x-auto">
                <Table>
                  <THead><TR><TH>Date</TH><TH>Type</TH><TH numeric>Amount</TH><TH>Reason</TH></TR></THead>
                  <tbody>
                    {adjustments.map((a) => (
                      <TR key={a._id}>
                        <TD className="tnum">{formatDateShort(a.createdAt)}</TD>
                        <TD>{a.deltaGross !== 0 ? `Work ${a.deltaGross > 0 ? "+" : ""}${safeINR(a.deltaGross)}` : `OT ${a.deltaOvertime > 0 ? "+" : ""}${safeINR(a.deltaOvertime)}`}</TD>
                        <TD numeric><span className={a.deltaNet > 0 ? "text-success" : "text-danger"}>{a.deltaNet > 0 ? "+" : ""}{safeINR(a.deltaNet)}</span></TD>
                        <TD className="max-w-[260px] truncate" title={a.reason}>{a.reason}</TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
