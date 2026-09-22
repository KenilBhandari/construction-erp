"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { formatDateShort, formatINR } from "@/lib/utils";
import type { SalaryDTO } from "@/types/salary";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !salaryId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
        return j.payments as PaymentDTO[];
      }),
    ])
      .then(([s, p]) => {
        setSalary(s);
        setPayments(p);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [open, salaryId]);

  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title={salary ? `${typeof salary.labour === "string" ? salary.labour : salary.labour.name} — Salary Detail` : "Salary Detail"}>
      {loading && <p className="text-sm text-text-muted">Loading…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      {!loading && !error && salary && (
        <div className="flex flex-col gap-4">
          <Card className="p-4">
            <p className="text-sm font-medium">{typeof salary.labour === "string" ? salary.labour : salary.labour.name}</p>
            <p className="text-sm text-text-muted">{formatDateShort(salary.periodStart)} – {formatDateShort(salary.periodEnd)}</p>
            <div className="mt-2">
              <Badge tone={salary.status === "paid" ? "success" : salary.status === "partially-paid" ? "warning" : "neutral"}>{STATUS_LABEL[salary.status]}</Badge>
              {salary.status !== "pending" && <span className="ml-2 text-xs text-text-muted">Locked — snapshot frozen</span>}
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-semibold">Attendance</h3>
            <dl className="mt-2 grid grid-cols-3 gap-3 text-sm">
              <div><dt className="text-text-muted">Present</dt><dd className="font-semibold tnum">{salary.presentDays}</dd></div>
              <div><dt className="text-text-muted">Half Day</dt><dd className="font-semibold tnum">{salary.halfDays}</dd></div>
              <div><dt className="text-text-muted">Absent</dt><dd className="font-semibold tnum">{salary.absentDays}</dd></div>
            </dl>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-semibold">Overtime</h3>
            <p className="text-sm tnum">{salary.overtimeHours} hrs · {formatINR(salary.overtimeAmount)}</p>
            <p className="text-xs text-text-muted">Records amount {formatINR(salary.overtimeRecordsAmount)}</p>
          </Card>
          <Card className="p-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-text-muted">Gross</dt><dd className="font-semibold tnum">{formatINR(salary.gross + salary.overtimeAmount)}</dd></div>
              <div><dt className="text-text-muted">Advance Recovery</dt><dd className="font-semibold tnum">{formatINR(salary.advanceRecovery)}</dd></div>
              <div><dt className="text-text-muted">Other Deductions</dt><dd className="font-semibold tnum">{formatINR(salary.deductions)}</dd></div>
              <div><dt className="text-text-muted">Net Salary</dt><dd className="font-semibold tnum">{formatINR(salary.net)}</dd></div>
              <div><dt className="text-text-muted">Paid</dt><dd className="font-semibold tnum">{formatINR(salary.paidAmount)}</dd></div>
              <div><dt className="text-text-muted">Remaining</dt><dd className="font-semibold tnum">{formatINR(salary.remainingAmount ?? salary.net - salary.paidAmount)}</dd></div>
            </dl>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-semibold">Payments</h3>
            {payments.length === 0 ? (
              <p className="mt-2 text-sm text-text-muted">No payments yet.</p>
            ) : (
              <Table>
                <THead><TR><TH>Date</TH><TH numeric>Amount</TH><TH>Method</TH><TH>Reference</TH></TR></THead>
                <tbody>
                  {payments.map((p) => (
                    <TR key={p._id}>
                      <TD>{formatDateShort(p.date)}</TD>
                      <TD numeric>{formatINR(p.amount)}</TD>
                      <TD>{p.paymentMethod}</TD>
                      <TD>{p.reference ?? "—"}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            )}
            <p className="mt-2 text-xs text-text-muted">Total Paid {formatINR(salary.paidAmount)} · Status {STATUS_LABEL[salary.status]}</p>
          </Card>
        </div>
      )}
    </Modal>
  );
}
