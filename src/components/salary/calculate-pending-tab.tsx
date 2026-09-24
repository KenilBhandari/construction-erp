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
        <p className="mt-1 text-sm text-text-muted">
          Attendance/OT → Labour earnings → Salary settlement → Salary payment{" "}
          <span className="mx-1 text-border">·</span> Advance → Recovery{" "}
          <em>or</em> Write-off — separate ledgers, never double-counted.
        </p>
        <p className="mt-1 text-xs text-text-muted">
          Formula:{" "}
          <span className="font-medium text-text">
            gross (present × daily + half × 0.5 + OT)
          </span>{" "}
          − recovery − deductions ={" "}
          <span className="font-semibold">net payable</span>. Recovery is per
          settlement; advances never auto-deduct.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select
            label="Worker *"
            value={calcLabour}
            onChange={(e) => setCalcLabour(e.target.value)}
          >
            <option value="">Select worker…</option>
            {labour.map((l) => (
              <option key={l._id} value={l._id}>
                {l.name} · {l.skill} · {safeINR(l.dailyRate)}/d
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
              Last calculation — {salaryLabourName(lastResult)} ·{" "}
              {formatDateShort(lastResult.periodStart)} –{" "}
              {formatDateShort(lastResult.periodEnd)}
            </h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-text-muted">Attendance earnings</dt>
                <dd className="mt-0.5 font-semibold tnum">
                  {safeINR(lastResult.gross)}
                </dd>
                <dd className="text-xs text-text-muted">
                  {lastResult.presentDays} present · {lastResult.halfDays} half
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Overtime</dt>
                <dd className="mt-0.5 font-semibold tnum">
                  {safeINR(lastResult.overtimeAmount)}
                </dd>
                <dd className="text-xs text-text-muted">
                  {lastResult.overtimeHours} hrs · records{" "}
                  {safeINR(lastResult.overtimeRecordsAmount)}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Gross (labour earnings)</dt>
                <dd className="mt-0.5 font-semibold tnum">
                  {safeINR(
                    toSafeNumber(lastResult.gross) +
                      toSafeNumber(lastResult.overtimeAmount),
                  )}
                </dd>
                <dd className="text-xs text-text-muted">
                  Site cost before deductions
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Net payable</dt>
                <dd className="mt-0.5 font-semibold tnum text-primary">
                  {safeINR(lastResult.net)}
                </dd>
                <dd className="text-xs text-text-muted">
                  Paid {safeINR(lastResult.paidAmount)} · Remaining{" "}
                  {safeINR(lastResult.remainingAmount)}
                </dd>
              </div>
            </dl>
            <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-text-muted">
                  Advance outstanding (before)
                </dt>
                <dd className="font-medium tnum">{safeINR(lastOutstanding)}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Recovery this settlement</dt>
                <dd
                  className={`font-semibold tnum ${toSafeNumber(lastResult.advanceRecovery) > 0 ? "text-warning" : ""}`}
                >
                  {safeINR(lastResult.advanceRecovery)}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Remaining advance (after)</dt>
                <dd className="font-semibold tnum">
                  {safeINR(
                    lastOutstanding !== null
                      ? Math.max(
                          0,
                          toSafeNumber(lastOutstanding) -
                            toSafeNumber(lastResult.advanceRecovery),
                        )
                      : null,
                  )}
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-text-muted">
              Other deductions {safeINR(lastResult.deductions)} · Recovery
              reduces <em>advance outstanding + salary payable</em>, not site
              labour cost.
            </p>
            {lastResult.earningsBreakdown &&
              lastResult.earningsBreakdown.length > 1 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-text">
                    Multi-site breakdown ({lastResult.earningsBreakdown.length}{" "}
                    sites)
                  </p>
                  <div className="mt-1 overflow-x-auto rounded border border-border">
                    <table className="w-full text-xs">
                      <thead className="bg-background">
                        <tr>
                          <th className="px-2 py-1 text-left font-medium text-text-muted">
                            Site
                          </th>
                          <th className="px-2 py-1 text-left font-medium text-text-muted">
                            Gross
                          </th>
                          <th className="px-2 py-1 text-left font-medium text-text-muted">
                            OT
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {lastResult.earningsBreakdown.map((b, idx) => {
                          const siteName =
                            b.siteName ??
                            (b.site &&
                            typeof b.site === "object" &&
                            "name" in b.site
                              ? (b.site as { name: string }).name
                              : null) ??
                            "Unassigned";
                          return (
                            <tr key={idx} className="border-t border-border">
                              <td className="px-2 py-1 tnum">
                                {siteName} {b.presentDays}P/{b.halfDays}H
                              </td>
                              <td className="px-2 py-1 tnum">
                                {safeINR(b.gross)}
                              </td>
                              <td className="px-2 py-1 tnum">
                                {safeINR(b.overtimeAmount)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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

      <div className="flex flex-col gap-3 sm:flex-row">
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
        <p className="self-center text-sm text-text-muted">
          Pending settlements only — frozen after first payment.
        </p>
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
          description="Calculate a worker's pay for a week or month to create a pending settlement. Multi-site work appears as one settlement with a breakdown."
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
                  <TH numeric>Paid</TH>
                  <TH numeric>Remaining</TH>
                  <TH>Status</TH>
                  <TH>Actions</TH>
                </TR>
              </THead>
              <tbody>
                {data.data.map((s) => {
                  const remaining = toSafeNumber(
                    s.remainingAmount ??
                      toSafeNumber(s.net) - toSafeNumber(s.paidAmount),
                  );
                  return (
                    <TR key={s._id}>
                      <TD>
                        <span className="font-medium">
                          {salaryLabourName(s)}
                        </span>
                        <p className="text-xs text-text-muted tnum">
                          {formatDateShort(s.periodStart)} –{" "}
                          {formatDateShort(s.periodEnd)}{" "}
                          {s.earningsBreakdown && s.earningsBreakdown.length > 1
                            ? `· ${s.earningsBreakdown.length} sites`
                            : ""}
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
                        <span className="font-semibold">{safeINR(s.net)}</span>
                      </TD>
                      <TD numeric>{safeINR(s.paidAmount)}</TD>
                      <TD numeric>
                        <span
                          className={
                            remaining > 0 ? "font-semibold text-warning" : ""
                          }
                        >
                          {safeINR(remaining)}
                        </span>
                      </TD>
                      <TD>
                        <Badge tone={STATUS_TONE[s.status]}>
                          {STATUS_LABEL[s.status]}
                        </Badge>
                      </TD>
                      <TD>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setViewing(s._id)}
                            className="text-sm text-text-muted hover:underline"
                          >
                            View
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
                            onClick={() => setEditing(s)}
                            className="text-sm text-text-muted hover:underline"
                          >
                            Edit
                          </button>
                          {remaining > 0 && (
                            <button
                              type="button"
                              onClick={() => setPaying(s)}
                              className="text-sm font-medium text-primary hover:underline"
                            >
                              Pay
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setDeleting(s);
                              setDeleteError(null);
                            }}
                            className="text-sm text-danger hover:underline"
                          >
                            Delete
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
