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
    <Modal open={open} onClose={onClose} size="xl" title={salary ? `${typeof salary.labour === "string" ? salary.labour : salary.labour.name} — Salary Detail` : "Salary Detail"}>
      {loading && <p className="text-sm text-text-muted">Loading…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      {!loading && !error && salary && (
        <div className="flex flex-col gap-4">
          {/* Settlement summary */}
          <Card className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{typeof salary.labour === "string" ? salary.labour : salary.labour.name}</p>
                <p className="text-sm text-text-muted tnum">{formatDateShort(salary.periodStart)} – {formatDateShort(salary.periodEnd)} · {toSafeNumber(salary.presentDays)}P / {toSafeNumber(salary.halfDays)}H · {toSafeNumber(salary.overtimeHours)} OT hrs</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge tone={salary.status === "paid" ? "success" : salary.status === "partially-paid" ? "warning" : "neutral"}>{STATUS_LABEL[salary.status]}</Badge>
                {salary.needsReconciliation && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-warning">Needs reconciliation — attendance changed after payment</span>}
                {salary.status !== "pending" && <span className="text-xs text-text-muted">Locked — snapshot frozen</span>}
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><dt className="text-text-muted">Attendance earnings (gross)</dt><dd className="mt-0.5 font-semibold tnum">{safeINR(salary.gross)}</dd></div>
              <div><dt className="text-text-muted">Overtime</dt><dd className="mt-0.5 font-semibold tnum">{safeINR(salary.overtimeAmount)}</dd><dd className="text-xs text-text-muted">records {safeINR(salary.overtimeRecordsAmount)}</dd></div>
              <div><dt className="text-text-muted">Gross (labour earned)</dt><dd className="mt-0.5 font-semibold tnum">{safeINR(toSafeNumber(salary.gross) + toSafeNumber(salary.overtimeAmount))}</dd></div>
              <div><dt className="text-text-muted">Snapshot rates</dt><dd className="mt-0.5 text-xs tnum">{safeINR(salary.snapshotDailyRate)}/d · {safeINR(salary.snapshotHourlyRate)}/h</dd></div>
            </dl>
            <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm sm:grid-cols-4">
              <div><dt className="text-text-muted">Advance recovery</dt><dd className="mt-0.5 font-semibold tnum">{safeINR(salary.advanceRecovery)}</dd><dd className="text-xs text-text-muted">Reduces advance outstanding</dd></div>
              <div><dt className="text-text-muted">Other deductions</dt><dd className="mt-0.5 font-semibold tnum">{safeINR(salary.deductions)}</dd></div>
              <div><dt className="text-text-muted">Net payable</dt><dd className="mt-0.5 font-semibold tnum text-primary">{safeINR(salary.net)}</dd></div>
              <div><dt className="text-text-muted">Paid / Remaining</dt><dd className="mt-0.5 font-semibold tnum">{safeINR(salary.paidAmount)} <span className="text-text-muted">/</span> <span className={toSafeNumber(salary.remainingAmount ?? toSafeNumber(salary.net) - toSafeNumber(salary.paidAmount)) > 0 ? "text-warning" : ""}>{safeINR(salary.remainingAmount)}</span></dd></div>
            </dl>
          </Card>

          {/* Earnings breakdown */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-text">Earnings breakdown — where work happened</h3>
            <p className="mt-1 text-xs text-text-muted">Historical site/project attribution at time of attendance. Unassigned = no site selected.</p>
            {!salary.earningsBreakdown || salary.earningsBreakdown.length === 0 ? (
              <p className="mt-3 text-sm text-text-muted">No breakdown — legacy record or no attendance. Gross is single-site total.</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded border border-border">
                <Table>
                  <THead><TR><TH>Site</TH><TH>Project</TH><TH numeric>P / H</TH><TH numeric>Work (₹)</TH><TH numeric>OT (₹)</TH><TH numeric>Total (₹)</TH></TR></THead>
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
                    <TR key="total" className="bg-background font-semibold">
                      <TD colSpan={3} className="text-right">Total labour earned</TD>
                      <TD numeric>{safeINR(salary.gross)}</TD>
                      <TD numeric>{safeINR(salary.overtimeAmount)}</TD>
                      <TD numeric>{safeINR(toSafeNumber(salary.gross) + toSafeNumber(salary.overtimeAmount))}</TD>
                    </TR>
                  </tbody>
                </Table>
              </div>
            )}
          </Card>

          {/* Payments */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-text">Payment history — actual cash paid</h3>
            <p className="mt-1 text-xs text-text-muted">Reduces remaining salary payable only — does not change site labour cost.</p>
            {payments.length === 0 ? (
              <p className="mt-3 text-sm text-text-muted">No payments yet.</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded border border-border">
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
            <p className="mt-2 text-xs text-text-muted">Total paid {safeINR(salary.paidAmount)} · Remaining {safeINR(salary.remainingAmount)} · Status {STATUS_LABEL[salary.status]}</p>
          </Card>

          {/* Adjustments */}
          {adjustments.length > 0 && (
            <Card className="p-4 border-warning bg-amber-50/40">
              <h3 className="text-sm font-semibold text-warning">Adjustments — attendance/OT changed after payment</h3>
              <p className="mt-1 text-xs text-text-muted">Not silently applied — requires reconciliation. Create a new settlement or manual correction.</p>
              <div className="mt-3 overflow-x-auto rounded border border-border bg-surface">
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
            </Card>
          )}
        </div>
      )}
    </Modal>
  );
}
