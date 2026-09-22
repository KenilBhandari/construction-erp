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
import { ConfirmDialog } from "@/components/ui/modal";
import { formatDateShort, formatINR, toDateInputValue } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { SalaryDTO, SalaryStatus } from "@/types/salary";
import { salaryLabourName } from "@/types/salary";
import type { LabourDTO } from "@/types/labour";
import type { SiteDTO } from "@/types/site";
import { SalaryDetailView } from "./salary-detail-view";
import { SalaryPaymentModal } from "./salary-payment-modal";
import { SalaryEditModal } from "./salary-edit-modal";

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
  const day = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - day);
  return toDateInputValue(monday);
}
function firstOfMonth(): string {
  const now = new Date();
  return toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
}

export function CalculatePendingTab() {
  const [calcLabour, setCalcLabour] = useState("");
  const [calcStart, setCalcStart] = useState(() => mondayOfThisWeek());
  const [calcEnd, setCalcEnd] = useState(() => toDateInputValue());
  const [calcRecovery, setCalcRecovery] = useState("0");
  const [calcDeductions, setCalcDeductions] = useState("0");
  const [calcPending, setCalcPending] = useState(false);
  const [calcMessage, setCalcMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [outstanding, setOutstanding] = useState<number | null>(null);
  const [outstandingLoading, setOutstandingLoading] = useState(false);

  const [labourId, setLabourId] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [labour, setLabour] = useState<LabourDTO[]>([]);
  const [sites, setSites] = useState<SiteDTO[]>([]);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState<SalaryDTO | null>(null);
  const [editing, setEditing] = useState<SalaryDTO | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<SalaryDTO | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/labour?limit=100&sort=name")
      .then(async (r) => r.json())
      .then((j) => {
        if (Array.isArray(j.data)) setLabour(j.data);
      })
      .catch(() => {});
    fetch("/api/sites?limit=100")
      .then(async (r) => r.json())
      .then((j) => {
        if (Array.isArray(j.data)) setSites(j.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!calcLabour) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOutstanding(null);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOutstandingLoading(true);
    fetch(`/api/labour/${calcLabour}/advance-summary`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Failed");
        setOutstanding(j.outstanding ?? 0);
      })
      .catch(() => setOutstanding(null))
      .finally(() => setOutstandingLoading(false));
  }, [calcLabour, reloadKey]);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: "20", status: "pending" });
    if (labourId) params.set("labour", labourId);
    fetch(`/api/salary?${params}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load salary.");
        if (!json || !Array.isArray(json.data)) throw new Error("Invalid salary response.");
        setData(json);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [labourId, page, reloadKey]);

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
    const recovery = calcRecovery === "" ? 0 : Number(calcRecovery);
    const deductions = calcDeductions === "" ? 0 : Number(calcDeductions);
    if (Number.isNaN(recovery) || recovery < 0 || Number.isNaN(deductions) || deductions < 0) {
      setCalcMessage({ kind: "error", text: "Recovery/deductions must be 0 or more." });
      return;
    }
    setCalcPending(true);
    setCalcMessage(null);
    try {
      // Site removed from core settlement UI per spec; send null
      const res = await fetch("/api/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labour: calcLabour,
          periodStart: calcStart,
          periodEnd: calcEnd,
          advanceRecovery: recovery,
          site: null,
          project: null,
          notes: null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Calculation failed.");
      // If deductions were entered, PATCH them (computeAndSave preserves deductions, but initial is 0)
      if (deductions > 0) {
        const s = json as SalaryDTO;
        const patch = await fetch(`/api/salary/${s._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deductions }),
        });
        const pj = await patch.json();
        if (!patch.ok) throw new Error(pj.error ?? "Failed to set deductions.");
      }
      const s = json as SalaryDTO;
      setCalcMessage({ kind: "ok", text: `Net payable ${formatINR(s.net)} (${s.presentDays} present, ${s.halfDays} half, ${s.overtimeHours} OT hrs, recovery ${formatINR(s.advanceRecovery)}).` });
      refresh();
    } catch (err) {
      setCalcMessage({ kind: "error", text: (err as Error).message });
    } finally {
      setCalcPending(false);
    }
  }

  async function handleRecalculate(s: SalaryDTO) {
    if (s.status !== "pending") {
      setError("Only pending settlements can be recalculated. This record is locked.");
      return;
    }
    const recalcLabourId = typeof s.labour === "string" ? s.labour : s.labour._id;
    try {
      const res = await fetch("/api/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labour: recalcLabourId,
          periodStart: new Date(s.periodStart).toISOString().slice(0, 10),
          periodEnd: new Date(s.periodEnd).toISOString().slice(0, 10),
          advanceRecovery: s.advanceRecovery,
          site: null,
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
        <p className="mt-1 text-sm text-text-muted">Attendance → gross. Recovery = amount you choose to recover this settlement. Formula: gross (present × daily + half × half + OT) − recovery − deductions = net.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select label="Worker" value={calcLabour} onChange={(e) => setCalcLabour(e.target.value)}>
            <option value="">Select worker…</option>
            {labour.map((l) => (
              <option key={l._id} value={l._id}>{l.name} · {l.skill}</option>
            ))}
          </Select>
          <Input label="Period start" type="date" value={calcStart} onChange={(e) => setCalcStart(e.target.value)} />
          <Input label="Period end" type="date" value={calcEnd} onChange={(e) => setCalcEnd(e.target.value)} />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label="Advance recovery (₹)" type="number" min={0} value={calcRecovery} onChange={(e) => setCalcRecovery(e.target.value)} placeholder="0" />
          <Input label="Other deductions (₹)" type="number" min={0} value={calcDeductions} onChange={(e) => setCalcDeductions(e.target.value)} placeholder="0" />
          <div className="flex flex-col justify-end gap-1">
            <p className="text-xs text-text-muted">Outstanding: {outstandingLoading ? "…" : outstanding !== null ? formatINR(outstanding) : "—"}</p>
            <p className="text-[11px] text-text-muted">Cannot exceed outstanding. 0 is valid.</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <button type="button" className="rounded-full border border-border px-3 py-1 text-text-muted hover:bg-background" onClick={() => { setCalcStart(mondayOfThisWeek()); setCalcEnd(toDateInputValue()); }}>This week</button>
          <button type="button" className="rounded-full border border-border px-3 py-1 text-text-muted hover:bg-background" onClick={() => { setCalcStart(firstOfMonth()); setCalcEnd(toDateInputValue()); }}>This month</button>
          <Button onClick={handleCalculate} disabled={calcPending} className="ml-2">{calcPending ? "Calculating…" : "Calculate"}</Button>
        </div>
        {calcMessage && <p role="status" className={cn("mt-3 text-sm", calcMessage.kind === "ok" ? "text-success" : "text-danger")}>{calcMessage.text}</p>}
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Select aria-label="Filter by worker" value={labourId} onChange={(e) => { setLabourId(e.target.value); setPage(1); }}>
            <option value="">All workers</option>
            {labour.map((l) => (<option key={l._id} value={l._id}>{l.name}</option>))}
          </Select>
        </div>
        <p className="text-sm text-text-muted self-center">Showing pending settlements only</p>
      </div>

      {loading && <TableSkeleton rows={6} />}
      {error && <p role="alert" className="text-sm text-danger">{error} <button type="button" className="underline" onClick={refresh}>Retry</button></p>}
      {!loading && !error && data && data.data.length === 0 && <EmptyState title="No pending settlements" description="Calculate a worker's pay for a week or month to create a pending settlement." />}
      {!loading && !error && data && data.data.length > 0 && (
        <>
          <Table>
            <THead><TR><TH>Worker / Period</TH><TH numeric>P / H</TH><TH numeric>OT hrs</TH><TH numeric>Gross</TH><TH numeric>Recovery</TH><TH numeric>Ded.</TH><TH numeric>Net</TH><TH numeric>Paid</TH><TH>Status</TH><TH>Actions</TH></TR></THead>
            <tbody>
              {data.data.map((s) => (
                <TR key={s._id}>
                  <TD><span className="font-medium">{salaryLabourName(s)}</span><p className="text-xs text-text-muted tnum">{formatDateShort(s.periodStart)} – {formatDateShort(s.periodEnd)}</p></TD>
                  <TD numeric>{s.presentDays} / {s.halfDays}</TD>
                  <TD numeric>{s.overtimeHours}</TD>
                  <TD numeric>{formatINR(s.gross + s.overtimeAmount)}</TD>
                  <TD numeric>{formatINR(s.advanceRecovery)}</TD>
                  <TD numeric>{formatINR(s.deductions)}</TD>
                  <TD numeric>{formatINR(s.net)}</TD>
                  <TD numeric>{formatINR(s.paidAmount)}</TD>
                  <TD><Badge tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge></TD>
                  <TD>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setViewing(s._id)} className="text-sm text-text-muted hover:underline">View</button>
                      <button type="button" onClick={() => handleRecalculate(s)} className="text-sm text-text-muted hover:underline">Recalculate</button>
                      <button type="button" onClick={() => setEditing(s)} className="text-sm text-text-muted hover:underline">Edit</button>
                      <button type="button" onClick={() => setPaying(s)} className="text-sm text-primary hover:underline">Pay</button>
                      <button type="button" onClick={() => { setDeleting(s); setDeleteError(null); }} className="text-sm text-danger hover:underline">Delete</button>
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
          <div className="flex items-center justify-between text-sm text-text-muted">
            <p className="tnum">{data.total} record(s) · Page {data.page} of {totalPages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}
      {paying && <SalaryPaymentModal record={paying} onClose={() => setPaying(null)} onSaved={() => { setPaying(null); refresh(); }} />}
      {editing && <SalaryEditModal record={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
      {viewing && <SalaryDetailView salaryId={viewing} open={!!viewing} onClose={() => setViewing(null)} />}
      <ConfirmDialog open={deleting !== null} onClose={() => setDeleting(null)} onConfirm={handleDelete} title="Delete this salary record?" description={deleteError ?? "Only pending settlements can be deleted."} pending={deletePending} />
    </div>
  );
}
