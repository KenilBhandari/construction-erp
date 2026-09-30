"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ComboSelect } from "@/components/ui/combo-select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { Pencil, Search, Trash2, X } from "lucide-react";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";
import { ResponsiveDate } from "@/components/ui/responsive-date";
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

export function AdvancesTab({
  advCmd,
}: {
  advCmd?: { kind: "add" | "writeoff"; n: number } | null;
} = {}) {
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
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

  // summary (global — not scoped to search)
  useEffect(() => {
    setSummaryLoading(true);
    fetch("/api/advances/summary")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Failed");
        setSummary({ totalGiven: toSafeNumber(j.totalGiven), totalRecovered: toSafeNumber(j.totalRecovered), totalWrittenOff: toSafeNumber(j.totalWrittenOff), outstanding: toSafeNumber(j.outstanding) });
      })
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false));
  }, [reloadKey]);

  // list
  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (appliedQ) params.set("q", appliedQ);
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
  }, [appliedQ, page, reloadKey]);

  // Debounce worker search so typing doesn't spam the API (labour pattern).
  useEffect(() => {
    const t = setTimeout(() => {
      setAppliedQ(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  function refresh() {
    setLoading(true);
    setReloadKey((k) => k + 1);
  }

  function clearFilters() {
    setQ("");
    setAppliedQ("");
    setPage(1);
  }

  const hasActiveFilters = q.trim() !== "";

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

  // Create signals from the page header (overtime pattern). Tab switches
  // clear the signal and unmount this tab, so nothing stale can reopen.
  useEffect(() => {
    if (!advCmd) return;
    if (advCmd.kind === "add") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditing(null);
      setFormOpen(true);
    } else {
      setWriteOffError(null);
      setWriteOffSuccess(null);
      setWriteOffAmount("");
      setWriteOffReason("");
      setWriteOffSite("");
      setWriteOffDate(toDateInputValue());
      setWriteOffOpen(true);
    }
  }, [advCmd]);

  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Card className="p-3">
          <p className="text-xs text-text-muted">Total Given</p>
          <p className="mt-0.5 text-lg font-semibold tnum">{summaryLoading ? "…" : summary ? safeINR(summary.totalGiven) : "—"}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-text-muted">Total Recovered</p>
          <p className="mt-0.5 text-lg font-semibold tnum">{summaryLoading ? "…" : summary ? safeINR(summary.totalRecovered) : "—"}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-text-muted">Written Off</p>
          <p className="mt-0.5 text-lg font-semibold tnum">{summaryLoading ? "…" : summary ? safeINR(summary.totalWrittenOff) : "—"}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-text-muted">Outstanding</p>
          <p className="mt-0.5 text-lg font-semibold tnum text-primary">{summaryLoading ? "…" : summary ? safeINR(summary.outstanding) : "—"}</p>
        </Card>
      </div>

      {/* Phone: search only. */}
      <div className="sm:hidden">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          />
          <Input
            aria-label="Search workers"
            placeholder="Search workers…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-9 pl-10 pr-10 text-sm"
          />
          {q && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQ("")}
              className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-text-muted hover:bg-background hover:text-text"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Desktop: search only, full-width row like Records. */}
      <div className="hidden sm:flex sm:flex-row">
        <div className="flex-1">
          <Input
            aria-label="Search workers"
            placeholder="Search name, phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-9 text-sm sm:h-10"
          />
        </div>
      </div>

      {loading && <TableSkeleton rows={6} />}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}{" "}
          <button type="button" className="underline" onClick={refresh}>
            Retry
          </button>
        </p>
      )}

      {!loading && !error && data && data.data.length === 0 && (
        <EmptyState
          title={hasActiveFilters ? "No advances found" : "No advances yet"}
          description={
            hasActiveFilters
              ? "No advances match the current search."
              : "Record money given in advance."
          }
          action={
            hasActiveFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : (
              <Button onClick={() => { setEditing(null); setFormOpen(true); }}>Add Advance</Button>
            )
          }
        />
      )}

      {!loading && !error && data && data.data.length > 0 && (
        <>
          {/* Phone cards — desktop table below stays untouched. */}
          <ul className="flex flex-col gap-2 sm:hidden">
            {data.data.map((a) => {
              const siteLabel = advanceSiteName(a) ?? "Unassigned";
              const reasonNotes = [a.reason, a.notes].filter(Boolean).join(" — ") || "—";
              return (
                <li key={a._id}>
                  <Card className="cursor-pointer p-3 active:bg-background">
                    <div
                      className="flex flex-col gap-1.5"
                      onClick={() => setViewing(a)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-[15px] font-medium text-primary">
                          {advanceLabourName(a)}
                        </span>
                        <span className="shrink-0 text-[15px] font-semibold tnum text-text">
                          {safeINR(a.amount)}
                        </span>
                      </div>
                      <p className="min-w-0 truncate text-xs text-text-muted tnum">
                        <ResponsiveDate date={a.date} /> · <span className={siteLabel === "Unassigned" ? "italic" : ""}>{siteLabel}</span>
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 flex-1 truncate text-xs text-text-muted">
                          <span className="mr-1 text-[11px] uppercase tracking-wide">Note</span>
                          {reasonNotes}
                        </p>
                        <div className="-mr-1.5 flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            aria-label="Edit advance"
                            onClick={() => { setEditing(a); setFormOpen(true); }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-primary/10 hover:text-primary"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label="Delete advance"
                            onClick={() => { setDeleting(a); setDeleteError(null); }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-danger/10 hover:text-danger"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>

          <div className="hidden sm:block">
          <Table>
              <THead><TR><TH>Date</TH><TH>Worker</TH><TH>Site</TH><TH numeric>Amount</TH><TH>Payment</TH><TH>Reference</TH><TH>Note</TH><TH className="text-right">Actions</TH></TR></THead>
              <tbody>
                {data.data.map((a) => {
                  const siteLabel = advanceSiteName(a) ?? "Unassigned";
                  const reasonNotes = [a.reason, a.notes].filter(Boolean).join(" — ") || "—";
                  return (
                    <TR key={a._id} className="cursor-pointer hover:bg-background/70" onClick={() => setViewing(a)}>
                      <TD className="tnum"><ResponsiveDate date={a.date} /></TD>
                      <TD><span className="font-medium text-primary">{advanceLabourName(a)}</span></TD>
                      <TD className={siteLabel === "Unassigned" ? "italic text-text-muted" : ""}>{siteLabel}</TD>
                      <TD numeric><span className="font-semibold">{safeINR(a.amount)}</span></TD>
                      <TD>{a.paymentMethod ?? "—"}</TD>
                      <TD className="tnum">{a.reference ?? "—"}</TD>
                      <TD className="max-w-[220px] truncate"><span title={reasonNotes}>{reasonNotes}</span></TD>
                      <TD>
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            aria-label="Edit advance"
                            title="Edit"
                            onClick={() => { setEditing(a); setFormOpen(true); }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-primary/10 hover:text-primary"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label="Delete advance"
                            title="Delete"
                            onClick={() => { setDeleting(a); setDeleteError(null); }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-danger/10 hover:text-danger"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted sm:text-sm">
            <p className="tnum">{data.total} advance(s) · Page {data.page} of {totalPages}</p>
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
        <Modal open={!!viewing} onClose={() => setViewing(null)} title="Advance Details">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-base font-semibold">{advanceLabourName(viewing)}</p>
              <p className="text-sm font-semibold tnum">{safeINR(viewing.amount)}</p>
            </div>
            <p className="-mt-3 text-xs text-text-muted tnum">{formatDateShort(viewing.date)}{viewing.paymentMethod ? ` · ${viewing.paymentMethod}` : ""}{viewing.reference ? ` · ${viewing.reference}` : ""}</p>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-text-muted">Site</dt><dd className={`mt-0.5 font-medium ${(advanceSiteName(viewing) ?? "Unassigned") === "Unassigned" ? "italic text-text-muted" : ""}`}>{advanceSiteName(viewing) ?? "Unassigned"}</dd></div>
              <div><dt className="text-xs text-text-muted">Note</dt><dd className="mt-0.5">{[viewing.reason, viewing.notes].filter(Boolean).join(" — ") || "—"}</dd></div>
            </dl>
            <div className="border-t border-border pt-3">
              <h3 className="text-sm font-medium text-text">Balance</h3>
              {viewSummary ? (
                <dl className="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-background p-3 text-sm sm:grid-cols-4">
                  <div><dt className="text-xs text-text-muted">Total given</dt><dd className="mt-0.5 font-semibold tnum">{safeINR(viewSummary.totalGiven)}</dd></div>
                  <div><dt className="text-xs text-text-muted">Recovered</dt><dd className="mt-0.5 font-semibold tnum">{safeINR(viewSummary.totalRecovered)}</dd></div>
                  <div><dt className="text-xs text-text-muted">Written off</dt><dd className="mt-0.5 font-semibold tnum">{safeINR(viewSummary.totalWrittenOff)}</dd></div>
                  <div><dt className="text-xs text-text-muted">Outstanding</dt><dd className="mt-0.5 font-semibold tnum text-primary">{safeINR(viewSummary.outstanding)}</dd></div>
                </dl>
              ) : <p className="mt-2 text-xs text-text-muted">Loading balance…</p>}
            </div>
          </div>
        </Modal>
      )}

      {writeOffOpen && (
        <Modal open={writeOffOpen} onClose={resetWriteOff} title="Write off outstanding advance">
          <form className="flex flex-col gap-3" onSubmit={handleWriteOff}>
            <ComboSelect
              label="Worker"
              required
              value={writeOffWorker}
              options={labour.map((l) => ({ value: l._id, label: `${l.name} · ${l.skill}` }))}
              onChange={(v) => { setWriteOffWorker(v); setWriteOffError(null); setWriteOffSuccess(null); }}
            />

            {writeOffWorker && (
              writeOffSummaryLoading ? (
                <p className="text-xs text-text-muted">Loading balance…</p>
              ) : writeOffSummary ? (
                <dl className="grid grid-cols-2 gap-2 rounded-lg bg-background p-3 text-sm sm:grid-cols-4">
                  <div><dt className="text-xs text-text-muted">Total given</dt><dd className="mt-0.5 font-semibold tnum">{safeINR(writeOffSummary.totalGiven)}</dd></div>
                  <div><dt className="text-xs text-text-muted">Recovered</dt><dd className="mt-0.5 font-semibold tnum">{safeINR(writeOffSummary.totalRecovered)}</dd></div>
                  <div><dt className="text-xs text-text-muted">Written off</dt><dd className="mt-0.5 font-semibold tnum">{safeINR(writeOffSummary.totalWrittenOff)}</dd></div>
                  <div><dt className="text-xs text-text-muted">Outstanding</dt><dd className="mt-0.5 font-semibold tnum text-primary">{safeINR(writeOffSummary.outstanding)}</dd></div>
                </dl>
              ) : (
                <p className="text-xs text-text-muted">No advance data.</p>
              )
            )}

            <div className="grid grid-cols-2 gap-3">
              <Input label="Amount (₹)" required type="number" min={1} max={writeOffSummary?.outstanding} value={writeOffAmount} onChange={(e) => setWriteOffAmount(e.target.value)} placeholder={writeOffSummary ? `max ${safeINR(writeOffSummary.outstanding)}` : "1000"} disabled={writeOffPending} />
              <Input label="Date" type="date" value={writeOffDate} onChange={(e) => setWriteOffDate(e.target.value)} disabled={writeOffPending} />
            </div>
            <Textarea label="Reason" required rows={2} value={writeOffReason} onChange={(e) => setWriteOffReason(e.target.value)} placeholder="Worker left, advance unrecoverable…" disabled={writeOffPending} />
            <ComboSelect
              label="Site (optional)"
              value={writeOffSite}
              options={[{ value: "", label: "Unassigned" }, ...writeOffSites.map((s) => ({ value: s._id, label: s.name }))]}
              onChange={setWriteOffSite}
              disabled={writeOffPending}
            />

            {writeOffError && <p role="alert" className="text-sm text-danger">{writeOffError}</p>}
            {writeOffSuccess && (
              <p role="status" className="text-sm font-medium text-success">{safeINR(writeOffSuccess.amount)} written off — Remaining: {safeINR(writeOffSuccess.remaining)}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetWriteOff} disabled={writeOffPending} className="h-11 sm:h-auto">Cancel</Button>
              <Button type="submit" disabled={writeOffPending || !writeOffWorker || !writeOffSummary || writeOffSummary.outstanding <= 0} className="h-11 sm:h-auto">{writeOffPending ? "Saving…" : "Write Off"}</Button>
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
    <Modal
      open
      onClose={onClose}
      title={initial ? "Edit Advance" : "Add Advance"}
    >
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        {initial ? (
          // Worker is immutable on edit — show it locked (overtime pattern).
          <div className="rounded-md bg-background p-3 text-sm">
            <p className="font-medium text-text">{advanceLabourName(initial)}</p>
          </div>
        ) : (
          <ComboSelect
            label="Worker"
            required
            value={labourId}
            options={labourOptions.map((l) => ({ value: l._id, label: `${l.name} · ${l.skill}` }))}
            onChange={setLabourId}
          />
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Date"
            required
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Input
            label="Amount (₹)"
            required
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="5000"
          />
        </div>
        <ComboSelect
          label="Site (optional)"
          value={siteId}
          options={[{ value: "", label: "Unassigned" }, ...sites.map((s) => ({ value: s._id, label: s.name }))]}
          onChange={setSiteId}
        />
        <div className={paymentMethod !== "Cash" ? "grid grid-cols-2 gap-3" : ""}>
          <ComboSelect
            label="Payment method"
            value={paymentMethod}
            options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}
            onChange={setPaymentMethod}
          />
          {paymentMethod !== "Cash" && (
            <Input
              label="Reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Txn / cheque no."
              className="h-9 text-sm sm:h-10 sm:py-0"
            />
          )}
        </div>
        <Input
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Family emergency…"
        />
        <Textarea
          label="Notes (optional)"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes…"
        />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={pending}
            className="h-11 sm:h-auto"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending} className="h-11 sm:h-auto">
            {pending ? "Saving…" : initial ? "Save Changes" : "Add Advance"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
