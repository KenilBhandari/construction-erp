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
import type { SiteDTO } from "@/types/site";

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

function siteNameOf(s: SalaryDTO): string | null {
  if (!s.site) return null;
  return typeof s.site === "string" ? s.site : s.site.name;
}

export function SalaryTab() {
  // Calculate form
  const [calcLabour, setCalcLabour] = useState("");
  const [calcStart, setCalcStart] = useState(() => mondayOfThisWeek());
  const [calcEnd, setCalcEnd] = useState(() => toDateInputValue());
  const [calcRecovery, setCalcRecovery] = useState("0");
  const [calcSite, setCalcSite] = useState("");
  const [calcPending, setCalcPending] = useState(false);
  const [calcMessage, setCalcMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [outstanding, setOutstanding] = useState<number | null>(null);
  const [outstandingLoading, setOutstandingLoading] = useState(false);

  // Table filters
  const [labourId, setLabourId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [labour, setLabour] = useState<LabourDTO[]>([]);
  const [sites, setSites] = useState<SiteDTO[]>([]);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState<SalaryDTO | null>(null);
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

  // Fetch outstanding for selected labour in calculate form
  useEffect(() => {
    if (!calcLabour) {
      setOutstanding(null);
      return;
    }
    setOutstandingLoading(true);
    fetch(`/api/labour/${calcLabour}/advance-summary`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Failed to load outstanding.");
        setOutstanding(j.outstanding ?? 0);
      })
      .catch(() => setOutstanding(null))
      .finally(() => setOutstandingLoading(false));
  }, [calcLabour, reloadKey]);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (labourId) params.set("labour", labourId);
    if (status) params.set("status", status);
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
    const recovery = calcRecovery === "" ? 0 : Number(calcRecovery);
    if (Number.isNaN(recovery) || recovery < 0) {
      setCalcMessage({ kind: "error", text: "Advance recovery must be 0 or more." });
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
          advanceRecovery: recovery,
          site: calcSite || null,
          notes: null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Calculation failed.");
      const s = json as SalaryDTO;
      setCalcMessage({
        kind: "ok",
        text: `Net payable ${formatINR(s.net)} (${s.presentDays} present, ${s.halfDays} half, ${s.overtimeHours} OT hrs, recovery ${formatINR(s.advanceRecovery)}).`,
      });
      refresh();
    } catch (err) {
      setCalcMessage({ kind: "error", text: (err as Error).message });
    } finally {
      setCalcPending(false);
    }
  }

  async function handleRecalculate(s: SalaryDTO) {
    const recalcLabourId = typeof s.labour === "string" ? s.labour : s.labour._id;
    const recalcSiteId = s.site ? (typeof s.site === "string" ? s.site : s.site._id) : null;
    try {
      const res = await fetch("/api/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labour: recalcLabourId,
          periodStart: new Date(s.periodStart).toISOString().slice(0, 10),
          periodEnd: new Date(s.periodEnd).toISOString().slice(0, 10),
          advanceRecovery: s.advanceRecovery,
          site: recalcSiteId,
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
          Attendance → gross. Advance = money previously given (recoverable). Recovery = amount you choose to recover this settlement. Write-off = unrecoverable amount converted to expense (via labour profile).
        </p>
        <p className="mt-1 text-xs text-text-muted">
          Formula: gross (present × daily + half × half + OT) − recovery (this settlement) − deductions = net. Advances never auto-deduct.
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
          <Select label="Site (attribution)" value={calcSite} onChange={(e) => setCalcSite(e.target.value)}>
            <option value="">No site</option>
            {sites.map((s) => (
              <option key={s._id} value={s._id}>{s.name}</option>
            ))}
          </Select>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            label="Advance recovery this settlement (₹)"
            type="number"
            min={0}
            value={calcRecovery}
            onChange={(e) => setCalcRecovery(e.target.value)}
            placeholder="0"
          />
          <div className="flex flex-col justify-end gap-1">
            <p className="text-xs text-text-muted">
              Outstanding: {outstandingLoading ? "…" : outstanding !== null ? formatINR(outstanding) : "—"} (labour-level, not site)
            </p>
            <p className="text-[11px] text-text-muted">Recovery recovers previously given advance. 0 is valid. Cannot exceed outstanding.</p>
          </div>
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
                <TH numeric>Recovery</TH>
                <TH numeric>Ded.</TH>
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
                      {siteNameOf(s) ? ` · ${siteNameOf(s)}` : ""}
                    </p>
                  </TD>
                  <TD numeric>{s.presentDays} / {s.halfDays}</TD>
                  <TD numeric>{s.overtimeHours}</TD>
                  <TD numeric>{formatINR(s.gross + s.overtimeAmount)}</TD>
                  <TD numeric><span title="Amount intentionally recovered from this salary">{formatINR(s.advanceRecovery)}</span></TD>
                  <TD numeric><span title="Other deductions">{formatINR(s.deductions)}</span></TD>
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
  const [advanceRecovery, setAdvanceRecovery] = useState(String(record.advanceRecovery));
  const [outstanding, setOutstanding] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const labourId = typeof record.labour === "string" ? record.labour : record.labour._id;

  useEffect(() => {
    fetch(`/api/labour/${labourId}/advance-summary`)
      .then(async (r) => {
        const j = await r.json();
        if (r.ok) setOutstanding(j.outstanding);
      })
      .catch(() => {});
  }, [labourId]);

  // Available for edit = outstanding + current recovery (so current value is always valid)
  const available = (outstanding ?? 0) + record.advanceRecovery;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const add = addPayment === "" ? 0 : Number(addPayment);
    const ded = deductions === "" ? 0 : Number(deductions);
    const rec = advanceRecovery === "" ? 0 : Number(advanceRecovery);
    if ([add, ded, rec].some((v) => Number.isNaN(v) || v < 0)) {
      setError("Amounts must be 0 or more.");
      return;
    }
    if (outstanding !== null && rec > available) {
      setError(`Recovery ₹${rec} exceeds available ₹${available} (outstanding ₹${outstanding} + current ₹${record.advanceRecovery}).`);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/salary/${record._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paidAmount: record.paidAmount + add, deductions: ded, advanceRecovery: rec }),
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
      <p className="mt-2 text-xs text-text-muted">
        Advance given (recoverable) outstanding: {outstanding !== null ? formatINR(outstanding) : "…"} · Available for this settlement: {outstanding !== null ? formatINR(available) : "…"} (outstanding + current recovery)
      </p>
      <p className="text-[11px] text-text-muted">Recovery recovers previously given advance. Write-off (unrecoverable → expense) is done in the labour profile.</p>
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
          label="Advance recovery this settlement (₹)"
          type="number"
          min={0}
          value={advanceRecovery}
          onChange={(e) => setAdvanceRecovery(e.target.value)}
        />
        <Input
          label="Other deductions (₹)"
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
