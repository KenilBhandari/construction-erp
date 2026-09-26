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
import { formatDateShort, safeINR, toDateInputValue, toSafeNumber } from "@/lib/utils";
import { CreditCardPlus, Pencil, RefreshCw, X } from "lucide-react";
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

export function CalculatePendingTab() {
  const [calcLabour, setCalcLabour] = useState("");
  const [calcStart, setCalcStart] = useState(() => firstOfMonth());
  const [calcEnd, setCalcEnd] = useState(() => toDateInputValue());
  const [calcRecovery, setCalcRecovery] = useState("0");
  const [calcDeductions, setCalcDeductions] = useState("0");
  const [calcPending, setCalcPending] = useState(false);
  const [calcMessage, setCalcMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [outstanding, setOutstanding] = useState<number | null>(null);
  const [outstandingLoading, setOutstandingLoading] = useState(false);
  const [lastResult, setLastResult] = useState<SalaryDTO | null>(null);
  const [lastOutstanding, setLastOutstanding] = useState<number | null>(null);

  const [labourId, setLabourId] = useState("");
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
    setOutstandingLoading(true);
    fetch(`/api/labour/${calcLabour}/advance-summary`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Failed");
        setOutstanding(toSafeNumber(j.outstanding, 0));
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

  const rawRecovery = calcRecovery.trim() === "" ? 0 : Number(calcRecovery);
  const rawDeductions = calcDeductions.trim() === "" ? 0 : Number(calcDeductions);
  const recoveryNum = toSafeNumber(calcRecovery, 0);
  const deductionsNum = toSafeNumber(calcDeductions, 0);
  const remainingAdvance = outstanding !== null ? Math.max(0, outstanding - recoveryNum) : null;
  const recoveryExceeds = outstanding !== null && recoveryNum > outstanding;

  async function handleCalculate() {
    if (!calcLabour) {
      setCalcMessage({ kind: "error", text: "Select a worker." });
      return;
    }
    if (!calcStart || !calcEnd || calcStart > calcEnd) {
      setCalcMessage({ kind: "error", text: "Pick a valid period." });
      return;
    }
    if (Number.isNaN(rawRecovery) || rawRecovery < 0 || Number.isNaN(rawDeductions) || rawDeductions < 0) {
      setCalcMessage({ kind: "error", text: "Recovery/deductions must be a valid number ≥ 0 (e.g. 0, 500). Check for letters or symbols." });
      return;
    }
    if (recoveryExceeds) {
      setCalcMessage({ kind: "error", text: `Recovery ${safeINR(recoveryNum)} exceeds outstanding ${safeINR(outstanding)}.` });
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
          advanceRecovery: recoveryNum,
          deductions: deductionsNum,
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
      setCalcMessage({ kind: "ok", text: "Settlement calculated — review breakdown below." });
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
    <div className="flex flex-col gap-6">
      <Card className="p-5">
        <h2 className="text-base font-semibold text-text">Calculate Salary</h2>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select
            label="Worker *"
            value={calcLabour}
            onChange={(e) => setCalcLabour(e.target.value)}
          >
            <option value="">Select worker…</option>
            {labour.map((l) => (
              <option key={l._id} value={l._id}>
                {l.name} - {l.skill}
              </option>
            ))}
          </Select>
          <Input
            label="Period start *"
            type="date"
            value={calcStart}
            onChange={(e) => setCalcStart(e.target.value)}
          />
          <Input
            label="Period end *"
            type="date"
            value={calcEnd}
            onChange={(e) => setCalcEnd(e.target.value)}
          />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Button
              onClick={handleCalculate}
              disabled={calcPending || recoveryExceeds}
              className="w-full sm:w-auto"
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
              {formatDateShort(lastResult.periodStart)} –{" "}
              {formatDateShort(lastResult.periodEnd)}
            </h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-text-muted">Attendance earnings</dt>
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
                    <dt className="text-text-muted">Advance outstanding (before)</dt>
                    <dd className="font-medium tnum">{safeINR(lastOutstanding)}</dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Recovery this settlement</dt>
                    <dd className={`font-semibold tnum ${rec > 0 ? "text-warning" : ""}`}>
                      {safeINR(lastResult.advanceRecovery)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Remaining advance (after)</dt>
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
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row max-w-xs">
        <div className="flex-1">
          <Select
            aria-label="Filter by worker"
            value={labourId}
            onChange={(e) => {
              setLabourId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All workers (pending)</option>
            {labour.map((l) => (
              <option key={l._id} value={l._id}>
                {l.name}
              </option>
            ))}
          </Select>
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
          title="No pending settlements"
          description="Calculate a worker's pay for a week or month to create a pending settlement."
        />
      )}
      {!loading && !error && data && data.data.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
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
                        <span className="font-medium">
                          {salaryLabourName(s)}
                        </span>
                        <p className="text-xs text-text-muted tnum">
                          {formatDateShort(s.periodStart)} –{" "}
                          {formatDateShort(s.periodEnd)}
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
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </div>
          <div className="flex items-center justify-between text-sm text-text-muted">
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
