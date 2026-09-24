"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";
import { formatDateShort, safeINR, toSafeNumber, toDateInputValue } from "@/lib/utils";
import type { AdvanceDTO } from "@/types/salary";
import { advanceLabourName, advanceSiteName } from "@/types/salary";
import type { LabourDTO } from "@/types/labour";
import type { SiteDTO } from "@/types/site";
import { PAYMENT_METHODS } from "@/types/finance";

interface ListResponse {
  data: AdvanceDTO[];
  page: number;
  limit: number;
  total: number;
  totalAmount: number;
}

interface Summary {
  totalGiven: number;
  totalRecovered: number;
  totalWrittenOff: number;
  outstanding: number;
}

export function AdvancesTab() {
  const [labourId, setLabourId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [labour, setLabour] = useState<LabourDTO[]>([]);
  const [data, setData] = useState<ListResponse | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdvanceDTO | null>(null);
  const [deleting, setDeleting] = useState<AdvanceDTO | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<AdvanceDTO | null>(null);
  const [viewSummary, setViewSummary] = useState<Summary | null>(null);

  // Write-off header-level modal
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  const [writeOffWorker, setWriteOffWorker] = useState("");
  const [writeOffSummary, setWriteOffSummary] = useState<Summary | null>(null);
  const [writeOffSummaryLoading, setWriteOffSummaryLoading] = useState(false);
  const [writeOffAmount, setWriteOffAmount] = useState("");
  const [writeOffDate, setWriteOffDate] = useState(() => toDateInputValue());
  const [writeOffReason, setWriteOffReason] = useState("");
  const [writeOffSite, setWriteOffSite] = useState("");
  const [writeOffSites, setWriteOffSites] = useState<SiteDTO[]>([]);
  const [writeOffPending, setWriteOffPending] = useState(false);
  const [writeOffError, setWriteOffError] = useState<string | null>(null);
  const [writeOffSuccess, setWriteOffSuccess] = useState<{ amount: number; remaining: number } | null>(null);

  useEffect(() => {
    fetch("/api/labour?limit=100&sort=name")
      .then(async (r) => r.json())
      .then((j) => {
        if (Array.isArray(j.data)) setLabour(j.data);
      })
      .catch(() => {});
  }, []);

  // summary
  useEffect(() => {
    setSummaryLoading(true);
    const url = labourId ? `/api/advances/summary?labour=${labourId}` : "/api/advances/summary";
    fetch(url)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Failed");
        setSummary({ totalGiven: toSafeNumber(j.totalGiven), totalRecovered: toSafeNumber(j.totalRecovered), totalWrittenOff: toSafeNumber(j.totalWrittenOff), outstanding: toSafeNumber(j.outstanding) });
      })
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false));
  }, [labourId, reloadKey]);

  // list
  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (labourId) params.set("labour", labourId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    setLoading(true);
    fetch(`/api/advances?${params}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load advances.");
        if (!json || !Array.isArray(json.data)) throw new Error("Invalid advances response.");
        setData(json);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [labourId, from, to, page, reloadKey]);

  function refresh() {
    setReloadKey((k) => k + 1);
  }

  // viewing summary
  useEffect(() => {
    if (!viewing) return;
    const lid = typeof viewing.labour === "string" ? viewing.labour : viewing.labour._id;
    fetch(`/api/advances/summary?labour=${lid}`)
      .then(async (r) => {
        const j = await r.json();
        if (r.ok) setViewSummary({ totalGiven: toSafeNumber(j.totalGiven), totalRecovered: toSafeNumber(j.totalRecovered), totalWrittenOff: toSafeNumber(j.totalWrittenOff), outstanding: toSafeNumber(j.outstanding) });
      })
      .catch(() => setViewSummary(null));
  }, [viewing]);

  // write-off worker summary
  useEffect(() => {
    if (!writeOffOpen) return;
    fetch("/api/sites?limit=100")
      .then(async (r) => r.json())
      .then((j) => { if (Array.isArray(j.data)) setWriteOffSites(j.data); })
      .catch(() => {});
  }, [writeOffOpen]);

  useEffect(() => {
    if (!writeOffOpen || !writeOffWorker) {
      setWriteOffSummary(null);
      return;
    }
    setWriteOffSummaryLoading(true);
    fetch(`/api/labour/${writeOffWorker}/advance-summary`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Failed");
        setWriteOffSummary({ totalGiven: toSafeNumber(j.totalGiven), totalRecovered: toSafeNumber(j.totalRecovered), totalWrittenOff: toSafeNumber(j.totalWrittenOff), outstanding: toSafeNumber(j.outstanding) });
      })
      .catch(() => setWriteOffSummary(null))
      .finally(() => setWriteOffSummaryLoading(false));
  }, [writeOffWorker, writeOffOpen]);

  // prefill write-off worker from filter when opening
  useEffect(() => {
    if (writeOffOpen && !writeOffWorker && labourId) setWriteOffWorker(labourId);
  }, [writeOffOpen, labourId, writeOffWorker]);

  async function handleDelete() {
    if (!deleting) return;
    setDeletePending(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/advances/${deleting._id}`, { method: "DELETE" });
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

  async function handleWriteOff(e: React.FormEvent) {
    e.preventDefault();
    if (!writeOffWorker) {
      setWriteOffError("Select a worker.");
      return;
    }
    const amt = Number(writeOffAmount);
    if (Number.isNaN(amt) || amt < 1) {
      setWriteOffError("Write-off amount must be at least ₹1.");
      return;
    }
    if (!writeOffReason.trim()) {
      setWriteOffError("Reason is required.");
      return;
    }
    if (writeOffSummary && amt > writeOffSummary.outstanding) {
      setWriteOffError(`Write-off ${safeINR(amt)} exceeds outstanding ${safeINR(writeOffSummary.outstanding)}.`);
      return;
    }
    if (writeOffPending) return;
    setWriteOffPending(true);
    setWriteOffError(null);
    try {
      const idem = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const res = await fetch(`/api/labour/${writeOffWorker}/write-off`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Idempotency-Key": idem },
        body: JSON.stringify({
          amount: amt,
          date: writeOffDate || undefined,
          site: writeOffSite || null,
          description: writeOffReason.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Write-off failed.");
      const remaining = toSafeNumber(json.summary?.outstanding ?? (writeOffSummary ? writeOffSummary.outstanding - amt : 0));
      setWriteOffSuccess({ amount: amt, remaining });
      setWriteOffAmount("");
      setWriteOffReason("");
      refresh();
      // keep modal open to show success, auto-reset after 2s
      setTimeout(() => {
        setWriteOffSuccess(null);
      }, 2500);
    } catch (err) {
      setWriteOffError((err as Error).message);
    } finally {
      setWriteOffPending(false);
    }
  }

  function resetWriteOff() {
    setWriteOffOpen(false);
    setWriteOffWorker("");
    setWriteOffAmount("");
    setWriteOffReason("");
    setWriteOffSite("");
    setWriteOffDate(toDateInputValue());
    setWriteOffError(null);
    setWriteOffSuccess(null);
    setWriteOffSummary(null);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-text">Advances — recoverable, not expenses</p>
            <p className="text-xs text-text-muted">Advance → Recovery <em>or</em> Write-off. Separate from salary payment and site labour cost.</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setWriteOffError(null);
                setWriteOffSuccess(null);
                setWriteOffAmount("");
                setWriteOffReason("");
                setWriteOffSite("");
                setWriteOffDate(toDateInputValue());
                setWriteOffOpen(true);
              }}
              disabled={summary ? summary.outstanding <= 0 : false}
              title={summary && summary.outstanding <= 0 ? "No outstanding to write off" : "Write off unrecoverable outstanding as expense"}
            >
              Write Off
            </Button>
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>Add Advance</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Given" value={summaryLoading ? "…" : summary ? safeINR(summary.totalGiven) : "—"} hint="Money given" />
        <StatCard label="Total Recovered" value={summaryLoading ? "…" : summary ? safeINR(summary.totalRecovered) : "—"} hint="Via salary recovery" />
        <StatCard label="Total Written Off" value={summaryLoading ? "…" : summary ? safeINR(summary.totalWrittenOff) : "—"} hint="Unrecoverable → expense" />
        <StatCard label="Outstanding" value={summaryLoading ? "…" : summary ? safeINR(summary.outstanding) : "—"} hint={labourId ? "For selected worker" : "All workers"} />
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select aria-label="Filter by worker" value={labourId} onChange={(e) => { setLabourId(e.target.value); setPage(1); }}>
            <option value="">All workers</option>
            {labour.map((l) => (<option key={l._id} value={l._id}>{l.name}</option>))}
          </Select>
          <Input label="From" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          <Input label="To" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </div>
        {(from || to || labourId) && <button type="button" onClick={() => { setLabourId(""); setFrom(""); setTo(""); setPage(1); }} className="mt-2 text-xs text-primary hover:underline">Clear filters</button>}
      </Card>

      {loading && <TableSkeleton rows={6} />}
      {error && <p role="alert" className="text-sm text-danger">{error} <button type="button" className="underline" onClick={refresh}>Retry</button></p>}

      {!loading && !error && data && data.data.length === 0 && (
        <EmptyState title="No advances yet" description="Record money given in advance — outstanding until recovered (salary) or written off (expense)." action={<Button onClick={() => { setEditing(null); setFormOpen(true); }}>Add Advance</Button>} />
      )}

      {!loading && !error && data && data.data.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <THead><TR><TH>Date</TH><TH>Worker</TH><TH>Site / Project</TH><TH numeric>Amount</TH><TH>Payment</TH><TH>Reference</TH><TH>Reason / Notes</TH><TH>Actions</TH></TR></THead>
              <tbody>
                {data.data.map((a) => {
                  const siteLabel = advanceSiteName(a) ?? "—";
                  const projectLabel = a.project && typeof a.project === "object" && "name" in a.project ? (a.project as { name: string }).name : a.project ? String(a.project) : "";
                  const siteProject = projectLabel ? `${siteLabel} · ${projectLabel}` : siteLabel;
                  const reasonNotes = [a.reason, a.notes].filter(Boolean).join(" — ") || "—";
                  return (
                    <TR key={a._id}>
                      <TD className="tnum">{formatDateShort(a.date)}</TD>
                      <TD className="font-medium">{advanceLabourName(a)}</TD>
                      <TD>{siteProject}</TD>
                      <TD numeric><span className="font-semibold">{safeINR(a.amount)}</span></TD>
                      <TD>{a.paymentMethod ?? "—"}</TD>
                      <TD className="tnum">{a.reference ?? "—"}</TD>
                      <TD className="max-w-[220px] truncate"><span title={reasonNotes}>{reasonNotes}</span></TD>
                      <TD>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setViewing(a)} className="text-sm text-primary hover:underline">View</button>
                          <button type="button" onClick={() => { setEditing(a); setFormOpen(true); }} className="text-sm text-text-muted hover:underline">Edit</button>
                          <button type="button" onClick={() => { setDeleting(a); setDeleteError(null); }} className="text-sm text-danger hover:underline">Delete</button>
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </div>
          <div className="flex items-center justify-between text-sm text-text-muted">
            <p className="tnum">{data.total} advance(s) · {safeINR(data.totalAmount)} in filter · Page {data.page} of {totalPages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}

      {formOpen && (
        <AdvanceFormModal
          key={editing?._id ?? "new"}
          initial={editing}
          labourOptions={labour}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); refresh(); }}
        />
      )}

      {viewing && (
        <Modal open={!!viewing} onClose={() => setViewing(null)} title={`Advance — ${advanceLabourName(viewing)} · ${safeINR(viewing.amount)}`} size="lg">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-text-muted">Date</dt><dd className="font-medium tnum">{formatDateShort(viewing.date)}</dd></div>
              <div><dt className="text-text-muted">Amount</dt><dd className="font-semibold tnum">{safeINR(viewing.amount)}</dd></div>
              <div><dt className="text-text-muted">Worker</dt><dd className="font-medium">{advanceLabourName(viewing)}</dd></div>
              <div><dt className="text-text-muted">Site / Project</dt><dd>{advanceSiteName(viewing) ?? "—"} {viewing.project && typeof viewing.project === "object" && "name" in viewing.project ? `· ${(viewing.project as { name: string }).name}` : ""}</dd></div>
              <div><dt className="text-text-muted">Payment</dt><dd>{viewing.paymentMethod ?? "—"} {viewing.reference ? `· ${viewing.reference}` : ""}</dd></div>
              <div><dt className="text-text-muted">Reason</dt><dd>{viewing.reason ?? "—"}</dd></div>
            </div>
            {viewing.notes && <p className="text-sm text-text-muted">Notes: {viewing.notes}</p>}
            <Card className="p-3 bg-background">
              <p className="text-xs font-semibold text-text">Labour advance balance (single source of truth)</p>
              {viewSummary ? (
                <dl className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div><dt className="text-text-muted">Total given</dt><dd className="font-semibold tnum">{safeINR(viewSummary.totalGiven)}</dd></div>
                  <div><dt className="text-text-muted">Recovered</dt><dd className="font-semibold tnum">{safeINR(viewSummary.totalRecovered)}</dd></div>
                  <div><dt className="text-text-muted">Written off</dt><dd className="font-semibold tnum">{safeINR(viewSummary.totalWrittenOff)}</dd></div>
                  <div><dt className="text-text-muted">Outstanding</dt><dd className="font-semibold tnum text-primary">{safeINR(viewSummary.outstanding)}</dd></div>
                </dl>
              ) : <p className="mt-2 text-xs text-text-muted">Loading balance…</p>}
              <p className="mt-2 text-xs text-text-muted">Outstanding = given − recovered − written off. This advance is one of the &quot;given&quot; rows.</p>
            </Card>
            <p className="text-xs text-text-muted">Write-off covers unrecoverable outstanding as a separate expense — does not affect salary earned or site cost.</p>
          </div>
        </Modal>
      )}

      {writeOffOpen && (
        <Modal open={writeOffOpen} onClose={resetWriteOff} title="Write off outstanding advance" size="lg">
          <form className="flex flex-col gap-4" onSubmit={handleWriteOff}>
            <p className="text-sm font-medium text-text">Write off outstanding advance</p>
            <p className="text-xs text-text-muted">This does not delete the advance history. It records the unrecovered amount as a company expense.</p>

            <Select label="Worker *" required value={writeOffWorker} onChange={(e) => { setWriteOffWorker(e.target.value); setWriteOffError(null); setWriteOffSuccess(null); }}>
              <option value="">Select worker…</option>
              {labour.map((l) => (<option key={l._id} value={l._id}>{l.name} · {l.skill}</option>))}
            </Select>

            {writeOffWorker && (
              <Card className="p-3 bg-background">
                {writeOffSummaryLoading ? (
                  <p className="text-xs text-text-muted">Loading balance…</p>
                ) : writeOffSummary ? (
                  <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    <div><dt className="text-text-muted">Total given</dt><dd className="font-semibold tnum">{safeINR(writeOffSummary.totalGiven)}</dd></div>
                    <div><dt className="text-text-muted">Recovered</dt><dd className="font-semibold tnum">{safeINR(writeOffSummary.totalRecovered)}</dd></div>
                    <div><dt className="text-text-muted">Written off</dt><dd className="font-semibold tnum">{safeINR(writeOffSummary.totalWrittenOff)}</dd></div>
                    <div><dt className="text-text-muted">Outstanding</dt><dd className="font-semibold tnum text-primary">{safeINR(writeOffSummary.outstanding)}</dd></div>
                  </dl>
                ) : (
                  <p className="text-xs text-text-muted">No advance data.</p>
                )}
              </Card>
            )}

            <Input label="Write-off amount (₹) *" required type="number" min={1} max={writeOffSummary?.outstanding} value={writeOffAmount} onChange={(e) => setWriteOffAmount(e.target.value)} placeholder={writeOffSummary ? `max ${safeINR(writeOffSummary.outstanding)}` : "1000"} disabled={writeOffPending} />
            <Input label="Date" type="date" value={writeOffDate} onChange={(e) => setWriteOffDate(e.target.value)} disabled={writeOffPending} />
            <Textarea label="Reason *" required value={writeOffReason} onChange={(e) => setWriteOffReason(e.target.value)} placeholder="Worker left, advance unrecoverable…" disabled={writeOffPending} />
            <Select label="Site / Project — optional attribution" value={writeOffSite} onChange={(e) => setWriteOffSite(e.target.value)} disabled={writeOffPending}>
              <option value="">No site — GENERAL</option>
              {writeOffSites.map((s) => (<option key={s._id} value={s._id}>{s.name}</option>))}
            </Select>

            {writeOffError && <p role="alert" className="text-sm text-danger">{writeOffError}</p>}
            {writeOffSuccess && (
              <p role="status" className="text-sm font-medium text-success">✓ {safeINR(writeOffSuccess.amount)} written off — Remaining outstanding: {safeINR(writeOffSuccess.remaining)}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetWriteOff} disabled={writeOffPending}>Cancel</Button>
              <Button type="submit" disabled={writeOffPending || !writeOffWorker || !writeOffSummary || writeOffSummary.outstanding <= 0}>{writeOffPending ? "Saving…" : "Write Off"}</Button>
            </div>
          </form>
        </Modal>
      )}

      <ConfirmDialog open={deleting !== null} onClose={() => setDeleting(null)} onConfirm={handleDelete} title="Delete this advance?" description={deleteError ?? "This does not change already-recovered amounts in salary settlements. Outstanding will update."} pending={deletePending} />
    </div>
  );
}

function AdvanceFormModal({
  initial,
  labourOptions,
  onClose,
  onSaved,
}: {
  initial: AdvanceDTO | null;
  labourOptions: LabourDTO[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [labourId, setLabourId] = useState(initial ? (typeof initial.labour === "string" ? initial.labour : initial.labour._id) : "");
  const [siteId, setSiteId] = useState(initial?.site ? (typeof initial.site === "string" ? initial.site : initial.site._id) : "");
  const [date, setDate] = useState(initial ? new Date(initial.date).toISOString().slice(0, 10) : toDateInputValue());
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [reason, setReason] = useState(initial?.reason ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [paymentMethod, setPaymentMethod] = useState<string>(initial?.paymentMethod ?? "Cash");
  const [reference, setReference] = useState(initial?.reference ?? "");
  const [sites, setSites] = useState<SiteDTO[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sites?limit=100")
      .then(async (r) => r.json())
      .then((j) => { if (Array.isArray(j.data)) setSites(j.data); })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (amount === "" || Number(amount) < 1) {
      setError("Amount must be at least ₹1.");
      return;
    }
    if (!initial && (!labourId || !date)) {
      setError("Worker and date are required.");
      return;
    }
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        amount: Number(amount),
        date: date === "" ? undefined : date,
        site: siteId === "" ? null : siteId,
        reason: reason.trim() === "" ? null : reason.trim(),
        paymentMethod: paymentMethod || null,
        reference: reference.trim() === "" ? null : reference.trim(),
        notes: notes.trim() === "" ? null : notes.trim(),
        ...(initial ? {} : { labour: labourId }),
      };
      const url = initial ? `/api/advances/${initial._id}` : "/api/advances";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (!initial) headers["X-Idempotency-Key"] = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const res = await fetch(url, { method: initial ? "PATCH" : "POST", headers, body: JSON.stringify(payload) });
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
    <Modal open onClose={onClose} title={initial ? "Edit Advance" : "Add Advance"} size="lg">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {!initial && (
          <Select label="Worker *" required value={labourId} onChange={(e) => setLabourId(e.target.value)}>
            <option value="">Select worker…</option>
            {labourOptions.map((l) => (<option key={l._id} value={l._id}>{l.name} · {l.skill}</option>))}
          </Select>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Input label="Date *" required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Amount (₹) *" required type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5000" />
        </div>
        <Select label="Site (optional — attribution only)" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          <option value="">No site — outstanding belongs to labour</option>
          {sites.map((s) => (<option key={s._id} value={s._id}>{s.name}</option>))}
        </Select>
        <p className="text-xs text-text-muted">Project derived from site; advances are recoverable, not an expense. Site is attribution only.</p>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Payment method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            {PAYMENT_METHODS.map((m) => (<option key={m} value={m}>{m}</option>))}
          </Select>
          <Input label="Reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Txn / cheque no." />
        </div>
        <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Family emergency…" />
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes…" />
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : initial ? "Save Changes" : "Add Advance"}</Button>
        </div>
      </form>
    </Modal>
  );
}
