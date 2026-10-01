"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/ui/date-field";
import { ComboSelect } from "@/components/ui/combo-select";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/modal";
import { ResponsiveDate } from "@/components/ui/responsive-date";
import { formatDateShort, formatDateRange, safeINR, toDateInputValue, toSafeNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ChevronDown, CreditCardPlus, Pencil, RefreshCw, Search, Trash2, X } from "lucide-react";
import type { SalaryDTO, SalaryStatus } from "@/types/salary";
import { salaryLabourName } from "@/types/salary";
import type { LabourDTO } from "@/types/labour";
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

function firstOfMonth(): string {
  const now = new Date();
  return toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
}

// Server errors are verbose — trim to what the user needs. Overlap keeps its
// dates (the useful part) in short form; everything else passes through.
function friendlyCalcError(msg: string): string {
  const m = msg.match(/overlapping period \((\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})\)/);
  if (m) return `Already settled for ${formatDateShort(m[1])} – ${formatDateShort(m[2])}.`;
  return msg;
}

export function CalculatePendingTab() {
  const [calcOpen, setCalcOpen] = useState(true);
  const [calcLabour, setCalcLabour] = useState("");
  const [calcStart, setCalcStart] = useState(() => firstOfMonth());
  const [calcEnd, setCalcEnd] = useState(() => toDateInputValue());
  const [calcPending, setCalcPending] = useState(false);
  const [calcMessage, setCalcMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [outstanding, setOutstanding] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<SalaryDTO | null>(null);
  const [lastOutstanding, setLastOutstanding] = useState<number | null>(null);

  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [labour, setLabour] = useState<LabourDTO[]>([]);
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
  }, []);

  useEffect(() => {
    if (!calcLabour) {
      setOutstanding(null);
      return;
    }
    fetch(`/api/labour/${calcLabour}/advance-summary`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Failed");
        setOutstanding(toSafeNumber(j.outstanding, 0));
      })
      .catch(() => setOutstanding(null));
  }, [calcLabour, reloadKey]);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: "20", status: "pending" });
    if (appliedQ) params.set("q", appliedQ);
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

  function resetPage() {
    setPage(1);
  }

  function clearFilters() {
    setQ("");
    setAppliedQ("");
    resetPage();
  }

  const hasActiveFilters = q.trim() !== "";

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
    setLastResult(null);
    try {
      const idem = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const res = await fetch("/api/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Idempotency-Key": idem },
        body: JSON.stringify({
          labour: calcLabour,
          periodStart: calcStart,
          periodEnd: calcEnd,
          advanceRecovery: 0,
          deductions: 0,
          site: null,
          project: null,
          notes: null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Calculation failed.");
      const saved: SalaryDTO = json as SalaryDTO;
      setLastResult(saved);
      setLastOutstanding(outstanding);
      setCalcMessage({ kind: "ok", text: "Salary calculated — review below." });
      refresh();
    } catch (err) {
      setCalcMessage({ kind: "error", text: friendlyCalcError((err as Error).message) });
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
      const idem = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const res = await fetch("/api/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Idempotency-Key": idem },
        body: JSON.stringify({
          labour: recalcLabourId,
          periodStart: new Date(s.periodStart).toISOString().slice(0, 10),
          periodEnd: new Date(s.periodEnd).toISOString().slice(0, 10),
          advanceRecovery: s.advanceRecovery,
          deductions: s.deductions,
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
    <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
      <Card className="overflow-hidden p-0">
        <button
          type="button"
          onClick={() => setCalcOpen((o) => !o)}
          aria-expanded={calcOpen}
          aria-label={calcOpen ? "Collapse calculate salary" : "Expand calculate salary"}
          className="flex w-full items-center justify-between gap-2 p-3 text-left sm:p-4"
        >
          <span className="text-[15px] font-semibold text-text sm:text-base">Calculate Salary</span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "h-4 w-4 shrink-0 text-text-muted transition-transform duration-150",
              calcOpen && "rotate-180",
            )}
          />
        </button>

        {calcOpen && (
        <div className="border-t border-border p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
          <ComboSelect
            label="Worker"
            required
            ariaLabel="Select worker to calculate"
            value={calcLabour}
            options={labour.map((l) => ({ value: l._id, label: `${l.name} - ${l.skill}` }))}
            onChange={setCalcLabour}
            disabled={calcPending}
          />
          <DateField
            label="Period start *"
            value={calcStart}
            onChange={setCalcStart}
            disabled={calcPending}
            className="h-9 text-sm sm:h-10"
          />
          <DateField
            label="Period end *"
            value={calcEnd}
            onChange={setCalcEnd}
            disabled={calcPending}
            minDate={calcStart || undefined}
            className="h-9 text-sm sm:h-10"
          />
        </div>

        <div className="mt-2 sm:mt-3">
          <div>
            <Button
              onClick={handleCalculate}
              disabled={calcPending}
              className="h-10 w-full sm:w-auto"
            >
              {calcPending ? "Calculating…" : "Calculate"}
            </Button>
          </div>
        </div>

        {calcMessage && (
          <p
            role="status"
            className={`mt-3 text-sm ${calcMessage.kind === "ok" ? "text-success" : "text-danger"}`}
          >
            {calcMessage.text}
          </p>
        )}

        {lastResult && (
          <div className="mt-4 rounded-lg border border-border bg-background p-4">
            <h3 className="text-sm font-semibold text-text">
              {salaryLabourName(lastResult)} ·{" "}
              {formatDateRange(lastResult.periodStart, lastResult.periodEnd)}
            </h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-text-muted">Earnings</dt>
                <dd className="mt-0.5 font-semibold tnum">
                  {safeINR(lastResult.gross)}
                </dd>
              
              </div>
              <div>
                <dt className="text-text-muted">Overtime</dt>
                <dd className="mt-0.5 font-semibold tnum">
                  {safeINR(lastResult.overtimeAmount)}
                </dd>
             
              </div>
              <div>
                <dt className="text-text-muted">Gross</dt>
                <dd className="mt-0.5 font-semibold tnum">
                  {safeINR(
                    toSafeNumber(lastResult.gross) +
                      toSafeNumber(lastResult.overtimeAmount),
                  )}
                </dd>
             
              </div>
              <div>
                <dt className="text-text-muted">Net payable</dt>
                <dd className="mt-0.5 font-semibold tnum text-primary">
                  {safeINR(lastResult.net)}
                </dd>
               
              </div>
            </dl>
            {(() => {
              const before = toSafeNumber(lastOutstanding, 0);
              const rec = toSafeNumber(lastResult.advanceRecovery, 0);
              const after = lastOutstanding !== null ? Math.max(0, before - rec) : 0;
              const showAdvance = before > 0 || rec > 0 || after > 0;
              return showAdvance ? (
                <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-text-muted">Advance before</dt>
                    <dd className="font-medium tnum">{safeINR(lastOutstanding)}</dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Recovered</dt>
                    <dd className={`font-semibold tnum ${rec > 0 ? "text-warning" : ""}`}>
                      {safeINR(lastResult.advanceRecovery)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Advance left</dt>
                    <dd className="font-semibold tnum">{safeINR(after)}</dd>
                  </div>
                </dl>
              ) : null;
            })()}
         
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => setViewing(lastResult._id)}>
                View details
              </Button>
              {toSafeNumber(lastResult.remainingAmount) > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPaying(lastResult)}
                >
                  Pay {safeINR(lastResult.remainingAmount)}
                </Button>
              )}
            </div>
          </div>
        )}
        </div>
        )}
      </Card>

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
          title={hasActiveFilters ? "No pending settlements found" : "No pending settlements"}
          description={
            hasActiveFilters
              ? "No pending settlements match the current search or filter."
              : "Calculate a worker's pay for a week or month to create a pending settlement."
          }
          action={
            hasActiveFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      )}
      {!loading && !error && data && data.data.length > 0 && (
        <>
          {/* Phone cards — desktop table below stays untouched. */}
          <ul className="flex flex-col gap-2 sm:hidden">
            {data.data.map((s) => {
              const remaining = toSafeNumber(
                s.remainingAmount ??
                  toSafeNumber(s.net) - toSafeNumber(s.paidAmount),
              );
              return (
                <li key={s._id}>
                  <Card className="cursor-pointer p-3 active:bg-background">
                    <div
                      className="flex flex-col gap-1.5"
                      onClick={() => setViewing(s._id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-[15px] font-medium text-primary">
                          {salaryLabourName(s)}
                        </span>
                        <Badge tone={STATUS_TONE[s.status]} className="shrink-0">
                          {STATUS_LABEL[s.status]}
                        </Badge>
                      </div>
                      <p className="min-w-0 truncate text-xs text-text-muted tnum">
                        <ResponsiveDate date={s.periodStart} /> – <ResponsiveDate date={s.periodEnd} /> · Gross {safeINR(toSafeNumber(s.gross) + toSafeNumber(s.overtimeAmount))}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-[15px] font-semibold tnum text-text">
                          {safeINR(s.net)} <span className="text-xs font-normal text-text-muted">payable</span>
                          {toSafeNumber(s.advanceRecovery) > 0 && (
                            <span className="text-xs font-normal text-text-muted"> · −{safeINR(s.advanceRecovery)} recovery</span>
                          )}
                        </p>
                        <div className="-mr-1.5 flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
                          {remaining > 0 && (
                            <button
                              type="button"
                              aria-label="Pay"
                              onClick={() => setPaying(s)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-primary hover:bg-primary/10"
                            >
                              <CreditCardPlus className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            aria-label="Recalculate"
                            onClick={() => handleRecalculate(s)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-primary/10 hover:text-primary"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label="Edit settlement"
                            onClick={() => setEditing(s)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-primary/10 hover:text-primary"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label="Delete settlement"
                            onClick={() => {
                              setDeleting(s);
                              setDeleteError(null);
                            }}
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
              <THead>
                <TR>
                  <TH>Worker / Period</TH>
                  <TH numeric>P / H</TH>
                  <TH numeric>Gross</TH>
                  <TH numeric>Recovery</TH>
                  <TH numeric>Ded.</TH>
                  <TH numeric>Net</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <tbody>
                {data.data.map((s) => {
                  const remaining = toSafeNumber(
                    s.remainingAmount ??
                      toSafeNumber(s.net) - toSafeNumber(s.paidAmount),
                  );
                  return (
                    <TR key={s._id} className="cursor-pointer hover:bg-background/70" onClick={() => setViewing(s._id)}>
                      <TD>
                        <span className="font-medium text-primary">
                          {salaryLabourName(s)}
                        </span>
                        <p className="text-xs text-text-muted tnum">
                          <ResponsiveDate date={s.periodStart} /> –{" "}
                          <ResponsiveDate date={s.periodEnd} />
                        </p>
                      </TD>
                      <TD numeric>
                        {toSafeNumber(s.presentDays)}/{toSafeNumber(s.halfDays)}
                      </TD>
                      <TD numeric>
                        {safeINR(
                          toSafeNumber(s.gross) +
                            toSafeNumber(s.overtimeAmount),
                        )}
                      </TD>
                      <TD numeric>{safeINR(s.advanceRecovery)}</TD>
                      <TD numeric>{safeINR(s.deductions)}</TD>
                      <TD numeric>
                        <span
                          className={
                            remaining > 0 ? "font-semibold text-warning" : "font-semibold"
                          }
                        >
                          {safeINR(s.net)}
                        </span>
                      </TD>
                      <TD>
                        <Badge tone={STATUS_TONE[s.status]}>
                          {STATUS_LABEL[s.status]}
                        </Badge>
                      </TD>
                      <TD>
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {remaining > 0 && (
                            <button
                              type="button"
                              aria-label="Pay"
                              title="Pay"
                              onClick={() => setPaying(s)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-primary hover:bg-primary/10"
                            >
                              <CreditCardPlus className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            aria-label="Recalculate"
                            title="Recalculate"
                            onClick={() => handleRecalculate(s)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-primary/10 hover:text-primary"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label="Edit settlement"
                            title="Edit"
                            onClick={() => setEditing(s)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-primary/10 hover:text-primary"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label="Delete settlement"
                            title="Delete"
                            onClick={() => {
                              setDeleting(s);
                              setDeleteError(null);
                            }}
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
            <p className="tnum">
              {data.total} record(s) · Page {data.page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
      {paying && (
        <SalaryPaymentModal
          record={paying}
          onClose={() => setPaying(null)}
          onSaved={() => {
            setPaying(null);
            refresh();
            setLastResult(null);
          }}
        />
      )}
      {editing && (
        <SalaryEditModal
          record={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
      {viewing && (
        <SalaryDetailView
          salaryId={viewing}
          open={!!viewing}
          onClose={() => setViewing(null)}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete this salary record?"
        description={
          deleteError ??
          "Only pending settlements can be deleted. Recoveries remain traceable via outstanding."
        }
        pending={deletePending}
      />
    </div>
  );
}
