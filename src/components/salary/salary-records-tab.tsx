"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ComboSelect } from "@/components/ui/combo-select";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { ResponsiveDate } from "@/components/ui/responsive-date";
import { safeINR, toSafeNumber } from "@/lib/utils";
import { CreditCardPlus, Eye, Search, X } from "lucide-react";
import type { SalaryDTO, SalaryStatus } from "@/types/salary";
import { salaryLabourName } from "@/types/salary";
import { SalaryDetailView } from "./salary-detail-view";
import { SalaryPaymentModal } from "./salary-payment-modal";

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

export function SalaryRecordsTab() {
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [status, setStatus] = useState<string>(""); // "" = all
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [paying, setPaying] = useState<SalaryDTO | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (appliedQ) params.set("q", appliedQ);
    if (status) params.set("status", status);
    else params.set("status", "partially-paid,paid");
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
  }, [appliedQ, status, page, reloadKey]);

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
    setStatus("");
    resetPage();
  }

  const hasActiveFilters = q.trim() !== "" || status !== "";

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
      {/* Phone: search + status on one row. */}
      <div className="flex flex-row gap-2 sm:hidden">
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
        <div className="w-[132px] shrink-0">
          <ComboSelect
            ariaLabel="Filter by status"
            value={status}
            options={[
              { value: "", label: "All" },
              { value: "partially-paid", label: "Partially Paid" },
              { value: "paid", label: "Paid" },
            ]}
            onChange={(v) => {
              setStatus(v);
              resetPage();
            }}
          />
        </div>
      </div>

      {/* Desktop: search + status row. */}
      <div className="hidden sm:flex sm:flex-row sm:gap-3">
        <div className="flex-1">
          <Input
            aria-label="Search workers"
            placeholder="Search name, phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-9 text-sm sm:h-10"
          />
        </div>
        <div className="w-44 shrink-0 sm:w-48">
          <ComboSelect
            ariaLabel="Filter by status"
            value={status}
            options={[
              { value: "", label: "All statuses" },
              { value: "partially-paid", label: "Partially Paid" },
              { value: "paid", label: "Paid" },
            ]}
            onChange={(v) => {
              setStatus(v);
              resetPage();
            }}
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
          title={hasActiveFilters ? "No salary records found" : "No salary records"}
          description={
            hasActiveFilters
              ? "No salary records match the current search or filter."
              : "Paid and partially paid settlements appear here. Use Calculate & Pending to create new settlements."
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
                          {s.status === "partially-paid" && remaining > 0 && (
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
                            aria-label="View details"
                            onClick={() => setViewing(s._id)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-primary/10 hover:text-primary"
                          >
                            <Eye className="h-4 w-4" />
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
                          {s.status === "partially-paid" && remaining > 0 && (
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
                            aria-label="View details"
                            title="View"
                            onClick={() => setViewing(s._id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-primary/10 hover:text-primary"
                          >
                            <Eye className="h-4 w-4" />
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
      {viewing && (
        <SalaryDetailView
          salaryId={viewing}
          open={!!viewing}
          onClose={() => setViewing(null)}
        />
      )}
      {paying && (
        <SalaryPaymentModal
          record={paying}
          onClose={() => setPaying(null)}
          onSaved={() => {
            setPaying(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
