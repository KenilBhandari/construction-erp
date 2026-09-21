"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { formatDateShort, formatINR, toDateInputValue } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { SalaryDTO, SalaryStatus } from "@/types/salary";
import { salaryLabourName } from "@/types/salary";
import type { LabourDTO } from "@/types/labour";

interface ListResponse {
  data: SalaryDTO[];
  page: number;
  limit: number;
  total: number;
}

const STATUS_TONE: Record<SalaryStatus, "neutral" | "warning" | "success"> = {
  pending: "neutral",
  "partially-paid": "warning",
  paid: "success",
};

const STATUS_LABEL: Record<SalaryStatus, string> = {
  pending: "Pending",
  "partially-paid": "Partially Paid",
  paid: "Paid",
};

function mondayOfThisWeek(): string {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(now);
  monday.setDate(now.getDate() - day);
  return toDateInputValue(monday);
}

function firstOfMonth(): string {
  const now = new Date();
  return toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
}

export function SalaryTab() {
  // Calculate form
  const [calcLabour, setCalcLabour] = useState("");
  const [calcStart, setCalcStart] = useState(() => mondayOfThisWeek());
  const [calcEnd, setCalcEnd] = useState(() => toDateInputValue());
  const [calcPending, setCalcPending] = useState(false);
  const [calcMessage, setCalcMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  // Table filters
  const [labourId, setLabourId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [labour, setLabour] = useState<LabourDTO[]>([]);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState<SalaryDTO | null>(null);
  const [deleting, setDeleting] = useState<SalaryDTO | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/labour?limit=200&sort=name")
      .then(async (r) => r.json())
      .then((j) => {
        if (Array.isArray(j.data)) setLabour(j.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (labourId) params.set("labour", labourId);
    if (status) params.set("status", status);
    fetch(`/api/salary?${params}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load salary.");
        setData(json);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [labourId, status, page, reloadKey]);

  function refresh() {
    setLoading(true);
    setReloadKey((k) => k + 1);
  }

  async function handleCalculate() {
    if (!calcLabour) {
      setCalcMessage({ kind: "error", text: "Select a worker." });
      return;
    }
    if (!calcStart || !calcEnd || calcStart > calcEnd) {
      setCalcMessage({ kind: "error", text: "Pick a valid period." });
      return;
    }
    setCalcPending(true);
    setCalcMessage(null);
    try {
      const res = await fetch("/api/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labour: calcLabour,
          periodStart: calcStart,
          periodEnd: calcEnd,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Calculation failed.");
      const s = json as SalaryDTO;
      setCalcMessage({
        kind: "ok",
        text: `Net payable ${formatINR(s.net)} (${s.presentDays} present, ${s.halfDays} half, ${s.overtimeHours} OT hrs, ${formatINR(s.advances)} advances).`,
      });
      refresh();
    } catch (err) {
      setCalcMessage({ kind: "error", text: (err as Error).message });
    } finally {
      setCalcPending(false);
    }
  }

  async function handleRecalculate(s: SalaryDTO) {
    const labour = typeof s.labour === "string" ? s.labour : s.labour._id;
    try {
      const res = await fetch("/api/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labour,
          periodStart: new Date(s.periodStart).toISOString().slice(0, 10),
          periodEnd: new Date(s.periodEnd).toISOString().slice(0, 10),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Recalculation failed.");
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeletePending(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/salary/${deleting._id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Delete failed.");
      setDeleting(null);
      refresh();
    } catch (err) {
      setDeleteError((err as Error).message);
    } finally {
      setDeletePending(false);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-5">
        <h2 className="text-base font-semibold text-text">Calculate Salary</h2>
        <p className="mt-1 text-sm text-text-muted">
          From attendance in the period: present × daily + half × half + OT − advances.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Select label="Worker" value={calcLabour} onChange={(e) => setCalcLabour(e.target.value)}>
            <option value="">Select worker…</option>
            {labour.map((l) => (
              <option key={l._id} value={l._id}>{l.name} · {l.skill}</option>
            ))}
          </Select>
          <Input label="Period start" type="date" value={calcStart} onChange={(e) => setCalcStart(e.target.value)} />
          <Input label="Period end" type="date" value={calcEnd} onChange={(e) => setCalcEnd(e.target.value)} />
          <div className="flex items-end gap-2">
            <Button onClick={handleCalculate} disabled={calcPending}>
              {calcPending ? "Calculating…" : "Calculate"}
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            className="rounded-full border border-border px-3 py-1 text-text-muted hover:bg-background"
            onClick={() => { setCalcStart(mondayOfThisWeek()); setCalcEnd(toDateInputValue()); }}
          >
            This week
          </button>
          <button
            type="button"
            className="rounded-full border border-border px-3 py-1 text-text-muted hover:bg-background"
            onClick={() => { setCalcStart(firstOfMonth()); setCalcEnd(toDateInputValue()); }}
          >
            This month
          </button>
        </div>
        {calcMessage && (
          <p role="status" className={cn("mt-3 text-sm", calcMessage.kind === "ok" ? "text-success" : "text-danger")}>
            {calcMessage.text}
          </p>
        )}
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Select aria-label="Filter by worker" value={labourId} onChange={(e) => { setLabourId(e.target.value); setPage(1); }}>
            <option value="">All workers</option>
            {labour.map((l) => (
              <option key={l._id} value={l._id}>{l.name}</option>
            ))}
          </Select>
        </div>
        <Select aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="partially-paid">Partially Paid</option>
          <option value="paid">Paid</option>
        </Select>
      </div>

      {loading && <TableSkeleton rows={6} />}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error} <button type="button" className="underline" onClick={refresh}>Retry</button>
        </p>
      )}

      {!loading && !error && data && data.data.length === 0 && (
        <EmptyState
          title="No salary records yet"
          description="Calculate a worker's pay for a week or month to create the first record."
        />
      )}

      {!loading && !error && data && data.data.length > 0 && (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Worker / Period</TH>
                <TH numeric>P / H</TH>
                <TH numeric>OT hrs</TH>
                <TH numeric>Gross</TH>
                <TH numeric>Adv</TH>
                <TH numeric>Net</TH>
                <TH numeric>Paid</TH>
                <TH>Status</TH>
                <TH>Actions</TH>
              </TR>
            </THead>
            <tbody>
              {data.data.map((s) => (
                <TR key={s._id}>
                  <TD>
                    <span className="font-medium">{salaryLabourName(s)}</span>
                    <p className="text-xs text-text-muted tnum">
                      {formatDateShort(s.periodStart)} – {formatDateShort(s.periodEnd)}
                    </p>
                  </TD>
                  <TD numeric>{s.presentDays} / {s.halfDays}</TD>
                  <TD numeric>{s.overtimeHours}</TD>
                  <TD numeric>{formatINR(s.gross + s.overtimeAmount)}</TD>
                  <TD numeric>{formatINR(s.advances + s.deductions)}</TD>
                  <TD numeric>{formatINR(s.net)}</TD>
                  <TD numeric>{formatINR(s.paidAmount)}</TD>
                  <TD>
                    <Badge tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge>
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setPaying(s)}
                        className="text-sm text-primary hover:underline"
                      >
                        Pay
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRecalculate(s)}
                        className="text-sm text-text-muted hover:underline"
                      >
                        Recalc
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDeleting(s); setDeleteError(null); }}
                        className="text-sm text-danger hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>

          <div className="flex items-center justify-between text-sm text-text-muted">
            <p className="tnum">{data.total} record(s) · Page {data.page} of {totalPages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      {paying && (
        <PaymentModal
          key={paying._id}
          record={paying}
          onClose={() => setPaying(null)}
          onSaved={() => {
            setPaying(null);
            refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete this salary record?"
        description={deleteError ?? "Recalculate the period later to rebuild it from attendance."}
        pending={deletePending}
      />
    </div>
  );
}

function PaymentModal({
  record,
  onClose,
  onSaved,
}: {
  record: SalaryDTO;
  onClose: () => void;
  onSaved: () => void;
}) {
  const remaining = record.net - record.paidAmount;
  const [addPayment, setAddPayment] = useState(remaining > 0 ? String(remaining) : "");
  const [deductions, setDeductions] = useState(String(record.deductions));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const add = addPayment === "" ? 0 : Number(addPayment);
    const ded = deductions === "" ? 0 : Number(deductions);
    if (Number.isNaN(add) || add < 0 || Number.isNaN(ded) || ded < 0) {
      setError("Amounts must be 0 or more.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/salary/${record._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paidAmount: record.paidAmount + add, deductions: ded }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed.");
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Pay ${salaryLabourName(record)}`}>
      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-text-muted">Net</dt>
          <dd className="mt-0.5 font-semibold tnum">{formatINR(record.net)}</dd>
        </div>
        <div>
          <dt className="text-text-muted">Paid</dt>
          <dd className="mt-0.5 font-semibold tnum">{formatINR(record.paidAmount)}</dd>
        </div>
        <div>
          <dt className="text-text-muted">Remaining</dt>
          <dd className="mt-0.5 font-semibold tnum">{formatINR(remaining)}</dd>
        </div>
      </dl>
      <form className="mt-4 flex flex-col gap-4" onSubmit={handleSubmit}>
        <Input
          label="Add payment (₹)"
          type="number"
          min={0}
          value={addPayment}
          onChange={(e) => setAddPayment(e.target.value)}
          placeholder="0"
        />
        <Input
          label="Total deductions (₹)"
          type="number"
          min={0}
          value={deductions}
          onChange={(e) => setDeductions(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-danger">{error}</p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Record Payment"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
