"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ComboSelect } from "@/components/ui/combo-select";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/modal";
import { DateSortToggle, dateSortParam } from "@/components/ui/date-sort-toggle";
import type { DateSortDir } from "@/components/ui/date-sort-toggle";
import { AttendanceOtModal } from "@/components/attendance/attendance-ot-modal";
import { formatDateShort, formatINR, toDateInputValue } from "@/lib/utils";
import { Pencil, Search, Trash2, X } from "lucide-react";
import type { OvertimeDTO } from "@/types/attendance";
import type { SiteDTO } from "@/types/site";
import type { LabourDTO } from "@/types/labour";
import { useMarkDirtyFor, usePageOneList, useReferenceData } from "@/context/CacheContext";

interface ListResponse {
  data: OvertimeDTO[];
  page: number;
  limit: number;
  total: number;
  totalHours: number;
  totalAmount: number;
}

function refName(ref: OvertimeDTO["labour"] | OvertimeDTO["site"]): string {
  if (!ref) return "—";
  return typeof ref === "string" ? ref : ref.name;
}

function siteName(ref: OvertimeDTO["site"]): string | null {
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.name;
}

export function OvertimeList({
  createOpen,
  onCreateOpenChange,
}: {
  createOpen?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
} = {}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [siteId, setSiteId] = useState("");
  const [labourId, setLabourId] = useState("");
  const [page, setPage] = useState(1);
  const [sortDir, setSortDir] = useState<DateSortDir>("desc");
  const [reloadKey, setReloadKey] = useState(0);
  // Shared reference caches — no per-page labour/sites fetches.
  const { items: labour } = useReferenceData<LabourDTO>("labour");
  const { items: allSites } = useReferenceData<SiteDTO>("sites");
  const markDirtyFor = useMarkDirtyFor();
  // Page-1 default-view cache (default sort only). Filtered views fetch fresh.
  const {
    read: readOvertimePage,
    write: writeOvertimePage,
    isDirty: overtimePageDirty,
  } = usePageOneList<ListResponse>("overtime");
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<OvertimeDTO | null>(null);
  const [deleting, setDeleting] = useState<OvertimeDTO | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Controlled create signal from the page header. A boolean carries no
  // history, so remounts replay `false` (no-op) — nothing stale can reopen
  // the modal. Freshness on return comes free from the mount load below.
  useEffect(() => {
    if (createOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditing(null);
      setFormOpen(true);
    }
  }, [createOpen]);

  useEffect(() => {
    // Default view only; manual refresh (reloadKey) always refetches.
    // A refresh fetch still rewrites the cache via isDefault below.
    const isDefault =
      !appliedQ && !siteId && !labourId && sortDir === "desc" && page === 1;
    const useCache = isDefault && reloadKey === 0;
    if (useCache) {
      const hit = readOvertimePage();
      if (hit) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setData(hit.data);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setError(null);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(false);
        if (!hit.revalidate) return;
      }
    }
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (appliedQ) params.set("q", appliedQ);
    if (siteId) params.set("site", siteId);
    if (labourId) params.set("labour", labourId);
    params.set("sort", dateSortParam(sortDir));
    fetch(`/api/overtime?${params}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load overtime.");
        if (!json || !Array.isArray(json.data)) throw new Error("Invalid overtime response.");
        setData(json);
        setError(null);
        if (isDefault) writeOvertimePage(json);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
    // read/write are scope-bound helpers; isDirty re-runs after mutations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedQ, siteId, labourId, page, sortDir, reloadKey, overtimePageDirty]);

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

  function toggleSortDir() {
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    resetPage();
  }

  function clearFilters() {
    setQ("");
    setAppliedQ("");
    setSiteId("");
    setLabourId("");
    resetPage();
  }

  const hasActiveFilters =
    q.trim() !== "" || siteId !== "" || labourId !== "";

  const siteOptions = [
    { value: "", label: "All sites" },
    ...allSites.map((s) => ({ value: s._id, label: s.name })),
  ];
  const workerOptions = [
    { value: "", label: "All workers" },
    ...labour.map((l) => ({ value: l._id, label: l.name })),
  ];

  async function handleDelete() {
    if (!deleting) return;
    setDeletePending(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/overtime/${deleting._id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Delete failed.");
      setDeleting(null);
      markDirtyFor("overtime");
      refresh();
    } catch (err) {
      setDeleteError((err as Error).message);
    } finally {
      setDeletePending(false);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  function labourIdOf(ref: OvertimeDTO["labour"]): string | null {
    if (!ref) return null;
    return typeof ref === "string" ? ref : (ref as { _id: string })._id;
  }

  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
      {/* Phone: full-width search, site + worker below. */}
      <div className="flex flex-col gap-2 sm:hidden">
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
        <div className="flex flex-row gap-2">
          <div className="min-w-0 flex-1">
            <ComboSelect
              ariaLabel="Filter by site"
              value={siteId}
              options={siteOptions}
              onChange={(v) => { setSiteId(v); resetPage(); }}
            />
          </div>
          <div className="w-[132px] shrink-0">
            <ComboSelect
              ariaLabel="Filter by worker"
              value={labourId}
              options={workerOptions}
              onChange={(v) => { setLabourId(v); resetPage(); }}
            />
          </div>
        </div>
      </div>

      {/* Desktop: search + combos in one row. */}
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
            ariaLabel="Filter by site"
            value={siteId}
            options={siteOptions}
            onChange={(v) => { setSiteId(v); resetPage(); }}
          />
        </div>
        <div className="w-44 shrink-0">
          <ComboSelect
            ariaLabel="Filter by worker"
            value={labourId}
            options={workerOptions}
            onChange={(v) => { setLabourId(v); resetPage(); }}
          />
        </div>
      </div>

      {loading && <TableSkeleton rows={6} />}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error} <button type="button" className="underline" onClick={refresh}>Retry</button>
        </p>
      )}

      {!loading && !error && data && data.data.length === 0 && (
        <EmptyState
          title={hasActiveFilters ? "No overtime found" : "No overtime records"}
          description={
            hasActiveFilters
              ? "No records match the current search or filters. Try a different worker or clear your filters."
              : "Record extra hours with a custom rate — or leave blank to use the worker's hourly rate."
          }
          action={
            hasActiveFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : (
              <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
                Add Overtime
              </Button>
            )
          }
        />
      )}

      {!loading && !error && data && data.data.length > 0 && (
        <>
          {/* Phone sort bar — right-aligned pill below filters, cards untouched. */}
          <div className="-my-1 flex justify-end sm:hidden">
            <DateSortToggle dir={sortDir} onToggle={toggleSortDir} variant="pill" />
          </div>
          {/* Phone cards flow with the page — no fixed inner height. */}
          <ul className="flex flex-col gap-2 sm:hidden">
            {data.data.map((o) => (
              <li key={o._id}>
                <Card className="cursor-pointer p-3 active:bg-background">
                  <div
                    className="flex flex-col gap-1.5"
                    onClick={() => { const id = labourIdOf(o.labour); if (id) router.push(`/dashboard/labour/${id}`); }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-[15px] font-medium text-primary">
                        {refName(o.labour)}
                      </span>
                      <span className="shrink-0 text-xs text-text-muted tnum">
                        {formatDateShort(o.date)}
                      </span>
                    </div>
                    <p className="min-w-0 truncate text-xs text-text-muted">
                      {siteName(o.site) ?? "Unassigned"} · {o.hours}h @ {formatINR(o.rate)}/hr
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-[15px] font-semibold tnum text-text">
                        {formatINR(o.amount)}
                      </p>
                      <div className="-mr-1.5 flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          aria-label="Edit overtime"
                          onClick={() => { setEditing(o); setFormOpen(true); }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-primary/10 hover:text-primary"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Delete overtime"
                          onClick={() => { setDeleting(o); setDeleteError(null); }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>

          <div className="hidden sm:block">
          <Table>
            <THead>
              <TR>
                <TH><DateSortToggle dir={sortDir} onToggle={toggleSortDir} /></TH>
                <TH>Worker</TH>
                <TH>Site</TH>
                <TH numeric>Hours</TH>
                <TH numeric>Rate</TH>
                <TH numeric>Amount</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <tbody>
              {data.data.map((o) => (
                <TR key={o._id} className="cursor-pointer hover:bg-background/70" onClick={() => { const id = labourIdOf(o.labour); if (id) router.push(`/dashboard/labour/${id}`); }}>
                  <TD className="tnum">{formatDateShort(o.date)}</TD>
                  <TD className="font-medium text-primary">{refName(o.labour)}</TD>
                  <TD className={siteName(o.site) ? "" : "text-text-muted italic"}>{siteName(o.site) ?? "Unassigned"}</TD>
                  <TD numeric>{o.hours}</TD>
                  <TD numeric>{formatINR(o.rate)}</TD>
                  <TD numeric>{formatINR(o.amount)}</TD>
                  <TD>
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        aria-label="Edit overtime"
                        onClick={() => { setEditing(o); setFormOpen(true); }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-primary/10 hover:text-primary"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete overtime"
                        onClick={() => { setDeleting(o); setDeleteError(null); }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-danger/10 hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted sm:text-sm">
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

      {formOpen && (
        <AttendanceOtModal
          key={editing?._id ?? "new"}
          open
          labour={(() => {
            const ref = editing?.labour;
            const id = typeof ref === "object" && ref !== null ? ref._id : "";
            const found = labour.find((l) => l._id === id);
            return {
              _id: id,
              name: typeof ref === "object" && ref !== null ? ref.name : (found?.name ?? ""),
              hourlyRate: found?.hourlyRate ?? 0,
            };
          })()}
          date={editing ? new Date(editing.date).toISOString().slice(0, 10) : toDateInputValue()}
          sites={allSites}
          suggestedSiteId={null}
          existing={editing}
          labourOptions={labour.map((l) => ({ _id: l._id, name: l.name, hourlyRate: l.hourlyRate }))}
          onClose={() => { setFormOpen(false); onCreateOpenChange?.(false); }}
          onSaved={() => {
            setFormOpen(false);
            onCreateOpenChange?.(false);
            markDirtyFor("overtime");
            refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete this overtime record?"
        description={deleteError ?? "Salary totals will drop by this amount."}
        pending={deletePending}
      />
    </div>
  );
}
