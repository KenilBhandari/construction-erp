"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { formatDateShort, formatDateRange, safeINR, toSafeNumber } from "@/lib/utils";
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

type BreakdownItem = NonNullable<SalaryDTO["earningsBreakdown"]>[number];

function breakdownMeta(b: BreakdownItem): { siteName: string; projectName: string; total: number } {
  const siteName = b.siteName ?? (b.site && typeof b.site === "object" && "name" in b.site ? (b.site as { name: string }).name : null) ?? "Unassigned";
  const projectName = b.projectName ?? (b.project && typeof b.project === "object" && "name" in b.project ? (b.project as { name: string }).name : null) ?? "—";
  return { siteName, projectName, total: toSafeNumber(b.gross) + toSafeNumber(b.overtimeAmount) };
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
  const labourName =
    salary && typeof salary.labour !== "string" ? salary.labour.name : null;
 return (
  <Modal open={open} onClose={onClose} size="lg" title={labourName ? `Salary · ${labourName}` : "Salary Detail"}>
    {loading && <p className="text-sm text-text-muted">Loading…</p>}
    {error && <p className="text-sm text-danger">{error}</p>}
    {!loading && !error && salary && (() => {
      const grossTotal = toSafeNumber(salary.gross) + toSafeNumber(salary.overtimeAmount);
      const sites = salary.earningsBreakdown ?? [];

      return (
        <div className="flex max-h-[70dvh] min-h-0 flex-col">
          {/* Scrollable body */}
          <div className="scroll-area min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3 sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden">
            <div className="flex flex-col gap-4">

              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-text sm:text-base">{formatDateRange(salary.periodStart, salary.periodEnd)}</p>
                  <p className="mt-0.5 text-xs text-text-muted tnum">
                    {toSafeNumber(salary.presentDays)}P / {toSafeNumber(salary.halfDays)}H · {toSafeNumber(salary.overtimeHours)}h OT
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                  <Badge tone={salary.status === "paid" ? "success" : salary.status === "partially-paid" ? "warning" : "neutral"}>{STATUS_LABEL[salary.status]}</Badge>
                  {salary.status !== "pending" && <span className="text-[11px] text-text-muted">Locked</span>}
                </div>
              </div>

              {salary.needsReconciliation && (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-warning">
                  Needs reconciliation — attendance changed after payment.
                </p>
              )}

              {/* Summary */}
              <Card className="overflow-hidden p-0">
                <div className="flex flex-col gap-1 p-3 sm:flex-row sm:items-end sm:justify-between sm:p-4">
                  <div>
                    <p className="text-xs text-text-muted">Net payable</p>
                    <p className="mt-0.5 text-2xl font-bold tnum text-primary sm:text-[28px]">{safeINR(salary.net)}</p>
                  </div>
                  <div className="flex gap-3 sm:flex-col sm:items-end sm:gap-0.5 sm:text-right">
                    <p className="text-xs text-text-muted tnum">Paid {safeINR(salary.paidAmount)}</p>
                    <p className="text-xs font-medium tnum text-text">Remaining {safeINR(salary.remainingAmount)}</p>
                  </div>
                </div>
                <dl className="divide-y divide-border border-t border-border text-sm">
                  <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-4">
                    <dt className="text-xs text-text-muted">Earnings</dt>
                    <dd className="tnum">{safeINR(salary.gross)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-4">
                    <dt className="text-xs text-text-muted">Overtime</dt>
                    <dd className="tnum">{safeINR(salary.overtimeAmount)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-4">
                    <dt className="text-xs text-text-muted">Gross</dt>
                    <dd className="font-semibold tnum">{safeINR(grossTotal)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-4">
                    <dt className="text-xs text-text-muted">Recovery</dt>
                    <dd className={`tnum ${toSafeNumber(salary.advanceRecovery) > 0 ? "font-semibold text-warning" : "text-text-muted"}`}>{safeINR(salary.advanceRecovery)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-4">
                    <dt className="text-xs text-text-muted">Deductions</dt>
                    <dd className={`tnum ${toSafeNumber(salary.deductions) > 0 ? "font-semibold" : "text-text-muted"}`}>{safeINR(salary.deductions)}</dd>
                  </div>
                </dl>
              </Card>

              {/* Earnings breakdown */}
              <section>
                <h3 className="text-sm font-medium text-text">
                  Earnings breakdown{sites.length > 0 && <span className="ml-1 font-normal text-text-muted">· {sites.length} {sites.length === 1 ? "site" : "sites"}</span>}
                </h3>
                {sites.length === 0 ? (
                  <p className="mt-2 text-sm text-text-muted">No site-wise breakdown.</p>
                ) : (
                  <>
                    {/* Mobile */}
                    <ul className="mt-2 divide-y divide-border overflow-hidden rounded-lg border border-border sm:hidden">
                      {sites.map((b, idx) => {
                        const { siteName, total } = breakdownMeta(b);
                        return (
                          <li key={idx} className="px-3 py-2.5">
                            <div className="flex items-start justify-between gap-3">
                              <p className={`min-w-0 break-words text-sm ${siteName === "Unassigned" ? "italic text-text-muted" : "font-medium text-text"}`}>{siteName}</p>
                              <p className="shrink-0 text-sm font-semibold tnum">{safeINR(total)}</p>
                            </div>
                            <p className="mt-1 text-xs text-text-muted tnum">
                              {toSafeNumber(b.presentDays)}P/{toSafeNumber(b.halfDays)}H · Gross {safeINR(b.gross)} · OT {safeINR(b.overtimeAmount)}
                            </p>
                          </li>
                        );
                      })}
                      <li className="flex items-center justify-between gap-2 bg-background/50 px-3 py-2.5 text-sm">
                        <span className="text-text-muted">Total</span>
                        <span className="font-semibold tnum">{safeINR(grossTotal)}</span>
                      </li>
                    </ul>

                    {/* Desktop */}
                    <div className="mt-2 hidden sm:block">
                      <Table>
                        <THead><TR><TH>Site</TH><TH numeric>Present/Half</TH><TH numeric>Gross</TH><TH numeric>OT</TH><TH numeric>Total</TH></TR></THead>
                        <tbody>
                          {sites.map((b, idx) => {
                            const { siteName, total } = breakdownMeta(b);
                            return (
                              <TR key={idx}>
                                <TD><span className={`break-words ${siteName === "Unassigned" ? "italic text-text-muted" : "font-medium"}`}>{siteName}</span></TD>
                                <TD numeric>{toSafeNumber(b.presentDays)}/{toSafeNumber(b.halfDays)}</TD>
                                <TD numeric>{safeINR(b.gross)}</TD>
                                <TD numeric>{safeINR(b.overtimeAmount)}</TD>
                                <TD numeric><span className="font-semibold">{safeINR(total)}</span></TD>
                              </TR>
                            );
                          })}
                          <TR key="total" className="bg-background/50 text-sm">
                            <TD colSpan={2} className="text-right text-text-muted">Total</TD>
                            <TD numeric>{safeINR(salary.gross)}</TD>
                            <TD numeric>{safeINR(salary.overtimeAmount)}</TD>
                            <TD numeric><span className="font-semibold">{safeINR(grossTotal)}</span></TD>
                          </TR>
                        </tbody>
                      </Table>
                    </div>
                  </>
                )}
              </section>

              {/* Payments */}
              <section>
                <h3 className="text-sm font-medium text-text">
                  Payments{payments.length > 0 && <span className="ml-1 font-normal text-text-muted">· {payments.length}</span>}
                </h3>
                {payments.length === 0 ? (
                  <p className="mt-2 text-sm text-text-muted">No payments yet.</p>
                ) : (
                  <>
                    {/* Mobile */}
                    <ul className="mt-2 divide-y divide-border overflow-hidden rounded-lg border border-border sm:hidden">
                      {payments.map((p) => (
                        <li key={p._id} className="px-3 py-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold tnum">{safeINR(p.amount)}</span>
                            <span className="text-xs text-text-muted tnum">{formatDateShort(p.date)}</span>
                          </div>
                          {(p.paymentMethod || p.reference) && (
                            <p className="mt-0.5 break-words text-xs text-text-muted">{[p.paymentMethod, p.reference].filter(Boolean).join(" · ")}</p>
                          )}
                          {p.notes && <p className="mt-1 break-words text-xs text-text-muted">{p.notes}</p>}
                        </li>
                      ))}
                    </ul>

                    {/* Desktop */}
                    <div className="mt-2 hidden sm:block">
                      <Table>
                        <THead><TR><TH>Date</TH><TH numeric>Amount</TH><TH>Method / Ref</TH><TH>Notes</TH></TR></THead>
                        <tbody>
                          {payments.map((p) => (
                            <TR key={p._id}>
                              <TD className="tnum whitespace-nowrap">{formatDateShort(p.date)}</TD>
                              <TD numeric><span className="font-medium">{safeINR(p.amount)}</span></TD>
                              <TD className="break-words">{[p.paymentMethod, p.reference].filter(Boolean).join(" · ") || "—"}</TD>
                              <TD className="break-words">{p.notes || "—"}</TD>
                            </TR>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  </>
                )}
              </section>

              {/* Adjustments */}
              {adjustments.length > 0 && (
                <section>
                  <h3 className="text-sm font-medium text-text">
                    Adjustments<span className="ml-1 font-normal text-text-muted">· {adjustments.length}</span>
                  </h3>

                  {/* Mobile */}
                  <ul className="mt-2 divide-y divide-border overflow-hidden rounded-lg border border-border sm:hidden">
                    {adjustments.map((a) => (
                      <li key={a._id} className="px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm">
                            {a.deltaGross !== 0
                              ? `Work ${a.deltaGross > 0 ? "+" : ""}${safeINR(a.deltaGross)}`
                              : `OT ${a.deltaOvertime > 0 ? "+" : ""}${safeINR(a.deltaOvertime)}`}
                          </span>
                          <span className={`text-sm font-semibold tnum ${a.deltaNet > 0 ? "text-success" : "text-danger"}`}>
                            {a.deltaNet > 0 ? "+" : ""}{safeINR(a.deltaNet)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-text-muted tnum">{formatDateShort(a.createdAt)}</p>
                        {a.reason && <p className="mt-1 break-words text-xs text-text-muted">{a.reason}</p>}
                      </li>
                    ))}
                  </ul>

                  {/* Desktop */}
                  <div className="mt-2 hidden sm:block">
                    <Table>
                      <THead><TR><TH>Date</TH><TH>Type</TH><TH numeric>Amount</TH><TH>Reason</TH></TR></THead>
                      <tbody>
                        {adjustments.map((a) => (
                          <TR key={a._id}>
                            <TD className="tnum whitespace-nowrap">{formatDateShort(a.createdAt)}</TD>
                            <TD>
                              {a.deltaGross !== 0
                                ? `Work ${a.deltaGross > 0 ? "+" : ""}${safeINR(a.deltaGross)}`
                                : `OT ${a.deltaOvertime > 0 ? "+" : ""}${safeINR(a.deltaOvertime)}`}
                            </TD>
                            <TD numeric><span className={a.deltaNet > 0 ? "text-success" : "text-danger"}>{a.deltaNet > 0 ? "+" : ""}{safeINR(a.deltaNet)}</span></TD>
                            <TD className="break-words">{a.reason}</TD>
                          </TR>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </section>
              )}
            </div>
          </div>

          {/* Normal footer: flows after the body, never floats */}
          <div className="mt-3 flex shrink-0 justify-end">
            <Button variant="outline" onClick={onClose} className="h-10 w-full sm:h-auto sm:w-auto">Close</Button>
          </div>
        </div>
      );
    })()}
  </Modal>
);
}
