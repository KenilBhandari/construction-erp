"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ComboSelect } from "@/components/ui/combo-select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/modal";
import { formatDateShort, toDateInputValue } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { AttendanceStatus } from "@/types/attendance";
import type { SiteDTO } from "@/types/site";
import { AttendanceOtModal } from "./attendance-ot-modal";
import {
  X,
  Check,
  Search,
  UserCheck,
  UserRoundX,
  UserRoundMinus,
  ClockPlus,
} from "lucide-react";

interface RosterItem {
  labour: {
    _id: string;
    name: string;
    phone: string;
    skill: string;
    dailyRate: number;
    hourlyRate: number;
    assignedSite: string | { _id: string; name: string } | null;
  };
  attendance: {
    _id: string;
    labour: string;
    date: string;
    status: AttendanceStatus;
    site: string | { _id: string; name: string } | null;
    project: string | { _id: string; name: string } | null;
    notes: string | null;
    overtimeHours: number;
  } | null;
  suggestedSite: { _id: string; name: string } | null;
  overtime: {
    _id: string;
    labour: string;
    site: string | { _id: string; name: string } | null;
    project: string | { _id: string; name: string } | null;
    date: string;
    hours: number;
    rate: number;
    amount: number;
    notes: string | null;
  } | null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface RosterResponse {
  date: string;
  total: number;
  marked: number;
  remaining: number;
  present: number;
  halfDay: number;
  absent: number;
  roster: RosterItem[];
  sites: { _id: string; name: string }[];
}

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: "Present",
  "half-day": "Half Day",
  absent: "Absent",
};

const STATUS_TONE: Record<AttendanceStatus, "success" | "warning" | "danger"> =
  {
    present: "success",
    "half-day": "warning",
    absent: "danger",
  };

function siteIdOf(
  site: string | { _id: string; name: string } | null | undefined,
): string | null {
  if (!site) return null;
  return typeof site === "string" ? site : (site as { _id: string })._id;
}

export function AttendanceMuster({
  onOtChange,
}: { onOtChange?: () => void } = {}) {
  const router = useRouter();
  const [date, setDate] = useState(() => toDateInputValue());
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState<string>("all"); // all | siteId | "none"
  const [statusFilter, setStatusFilter] = useState<string>("all"); // all | present | half-day | absent
  const [completion, setCompletion] = useState<"all" | "remaining" | "marked">(
    "all",
  );
  const [roster, setRoster] = useState<RosterItem[] | null>(null);
  const [counters, setCounters] = useState<{
    total: number;
    marked: number;
    remaining: number;
    present: number;
    halfDay: number;
    absent: number;
  } | null>(null);
  const [sites, setSites] = useState<{ _id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState<{
    status: AttendanceStatus;
    mode: "remaining" | "allBelow" | "selected";
    count: number;
    overwriteCount?: number;
  } | null>(null);
  const [page, setPage] = useState(1);
  const limit = 40;

  // New UX states
  const [pendingSite, setPendingSite] = useState<Record<string, string | null>>(
    {},
  );
  const [siteSavingId, setSiteSavingId] = useState<string | null>(null);
  const [siteSavedId, setSiteSavedId] = useState<string | null>(null);
  const [otItem, setOtItem] = useState<RosterItem | null>(null);
  const [otEditing, setOtEditing] = useState<{
    _id: string;
    hours: number;
    rate: number;
    notes: string | null;
    site?: string | { _id: string; name: string } | null;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RosterItem | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const fetchRoster = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/attendance/roster?date=${date}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Failed to load roster");
      setRoster(j.roster);
      setCounters({
        total: j.total,
        marked: j.marked,
        remaining: j.remaining,
        present: j.present,
        halfDay: j.halfDay,
        absent: j.absent,
      });
      setSites(j.sites);
    } catch (e) {
      setError((e as Error).message);
      setRoster([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRoster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  useEffect(() => {
    if (sites.length === 0) {
      fetch("/api/sites?limit=100")
        .then(async (r) => {
          const j = await r.json();
          if (r.ok && Array.isArray(j.data))
            setSites(
              j.data.map((s: SiteDTO) => ({ _id: s._id, name: s.name })),
            );
        })
        .catch(() => {});
    }
  }, [sites.length]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(new Set());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [date, search, siteFilter, statusFilter, completion]);

  // Clear pending sites when date changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingSite({});
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [date]);

  const filtered = useMemo(() => {
    if (!roster) return [];
    let out = roster;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(
        (r) =>
          r.labour.name.toLowerCase().includes(q) ||
          r.labour.phone.toLowerCase().includes(q) ||
          r.labour.skill.toLowerCase().includes(q),
      );
    }
    if (completion === "remaining") out = out.filter((r) => !r.attendance);
    else if (completion === "marked") out = out.filter((r) => !!r.attendance);
    if (statusFilter !== "all") {
      out = out.filter((r) => r.attendance?.status === statusFilter);
    }
    if (siteFilter !== "all") {
      if (siteFilter === "none") {
        out = out.filter((r) => r.attendance && !r.attendance.site);
      } else {
        out = out.filter((r) => {
          if (!r.attendance) {
            return r.suggestedSite?._id === siteFilter;
          }
          const s = r.attendance.site;
          const sid = siteIdOf(s as string | { _id: string; name: string });
          return sid === siteFilter;
        });
      }
    }
    return out;
  }, [roster, search, siteFilter, statusFilter, completion]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const paginated = useMemo(
    () => filtered.slice((page - 1) * limit, page * limit),
    [filtered, page, limit],
  );
  const selectedCount = selected.size;
  const allPageSelected =
    paginated.length > 0 && paginated.every((r) => selected.has(r.labour._id));

  const toggleSelectAllPage = () => {
    if (allPageSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        paginated.forEach((r) => next.delete(r.labour._id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        paginated.forEach((r) => next.add(r.labour._id));
        return next;
      });
    }
  };

  const toggleSelect = (labourId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(labourId)) next.delete(labourId);
      else next.add(labourId);
      return next;
    });
  };

  const clearFilters = () => {
    setSearch("");
    setSiteFilter("all");
    setStatusFilter("all");
    setCompletion("all");
    setPage(1);
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    siteFilter !== "all" ||
    statusFilter !== "all" ||
    completion !== "all";

  const handleSiteAutoSave = async (
    item: RosterItem,
    newSiteId: string | null,
  ) => {
    if (!item.attendance) return;
    setSiteSavingId(item.attendance._id);
    setSiteSavedId(null);
    try {
      const res = await fetch(`/api/attendance/${item.attendance._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site: newSiteId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Site update failed");
      setSiteSavedId(item.attendance._id);
      setTimeout(
        () =>
          setSiteSavedId((prev) =>
            prev === item.attendance?._id ? null : prev,
          ),
        2000,
      );
      await fetchRoster();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSiteSavingId(null);
    }
  };

  const markOne = async (item: RosterItem, status: AttendanceStatus) => {
    if (item.attendance?.status === status) return;
    setSaving(true);
    try {
      let site: string | null = null;
      if (item.attendance) {
        site = siteIdOf(
          item.attendance.site as string | { _id: string; name: string },
        );
      } else {
        const pending = pendingSite[item.labour._id];
        if (pending !== undefined) site = pending;
        else site = item.suggestedSite?._id ?? null;
      }

      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          records: [
            {
              labour: item.labour._id,
              status,
              site,
              notes: item.attendance?.notes ?? null,
            },
          ],
          overwrite: true,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Failed to save");
      // Clear pending for this labour after successful mark
      setPendingSite((prev) => {
        const next = { ...prev };
        delete next[item.labour._id];
        return next;
      });
      await fetchRoster();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleMarkRemaining = async (status: AttendanceStatus) => {
    const remaining = filtered.filter((r) => !r.attendance);
    if (remaining.length === 0) return;
    const siteForBulk: string | null =
      siteFilter !== "all" && siteFilter !== "none" ? siteFilter : null;

    setSaving(true);
    try {
      const records = remaining.map((r) => {
        const pending = pendingSite[r.labour._id];
        const site =
          pending !== undefined
            ? pending
            : (r.suggestedSite?._id ?? siteForBulk);
        return { labour: r.labour._id, status, site };
      });
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, records, overwrite: false }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Bulk failed");
      setPendingSite({});
      await fetchRoster();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAllBelow = async (status: AttendanceStatus) => {
    const hasMarked = filtered.some((r) => !!r.attendance);
    if (hasMarked) {
      const overwriteCount = filtered.filter((r) => !!r.attendance).length;
      setConfirmBulk({
        status,
        mode: "allBelow",
        count: filtered.length,
        overwriteCount,
      });
      return;
    }
    await handleMarkRemaining(status);
  };

  const confirmMarkAllBelow = async () => {
    if (!confirmBulk) return;
    const status = confirmBulk.status;
    setConfirmBulk(null);
    setSaving(true);
    try {
      const siteForBulk: string | null =
        siteFilter !== "all" && siteFilter !== "none" ? siteFilter : null;
      const records = filtered.map((r) => {
        const pending = pendingSite[r.labour._id];
        const site = r.attendance
          ? siteIdOf(
              r.attendance.site as string | { _id: string; name: string },
            )
          : pending !== undefined
            ? pending
            : (r.suggestedSite?._id ?? siteForBulk);
        return { labour: r.labour._id, status, site };
      });
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, records, overwrite: true }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Bulk failed");
      setPendingSite({});
      await fetchRoster();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectedBulk = async (status: AttendanceStatus) => {
    const items = filtered.filter((r) => selected.has(r.labour._id));
    if (items.length === 0) return;
    const siteForBulk: string | null =
      siteFilter !== "all" && siteFilter !== "none" ? siteFilter : null;
    setSaving(true);
    try {
      const records = items.map((r) => {
        const pending = pendingSite[r.labour._id];
        const site = r.attendance
          ? siteIdOf(
              r.attendance.site as string | { _id: string; name: string },
            )
          : pending !== undefined
            ? pending
            : (r.suggestedSite?._id ?? siteForBulk);
        return { labour: r.labour._id, status, site };
      });
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, records, overwrite: true }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Bulk failed");
      setSelected(new Set());
      setPendingSite({});
      await fetchRoster();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.attendance) return;
    setDeletePending(true);
    try {
      const res = await fetch(
        `/api/attendance/${deleteTarget.attendance._id}`,
        { method: "DELETE" },
      );
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Delete failed");
      setDeleteTarget(null);
      await fetchRoster();
      onOtChange?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeletePending(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Card className="rounded-xl p-4 sm:rounded-lg sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-[15px] font-semibold tracking-tight text-text sm:text-base sm:tracking-normal">
            Attendance — {formatDateShort(date)}
          </h2>
          <Input
            aria-label="Select date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="sm:w-48"
          />
        </div>

        {counters && (
          <dl className="mt-3.5 grid grid-cols-3 gap-2.5 text-sm sm:mt-4 sm:grid-cols-6 sm:gap-4">
            <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
              <dt className="text-xs text-text-muted sm:text-sm">
                Total Labour
              </dt>
              <dd className="mt-0.5 truncate text-[15px] font-semibold tnum sm:mt-1 sm:text-base">
                {counters.total}
              </dd>
            </div>
            <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
              <dt className="text-xs text-text-muted sm:text-sm">Marked</dt>
              <dd className="mt-0.5 truncate text-[15px] font-semibold tnum sm:mt-1 sm:text-base">
                {counters.marked}
              </dd>
            </div>
            <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
              <dt className="text-xs text-text-muted sm:text-sm">Not Marked</dt>
              <dd className="mt-0.5 truncate text-[15px] font-semibold tnum sm:mt-1 sm:text-base">
                {counters.remaining}
              </dd>
            </div>
            <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
              <dt className="text-xs text-text-muted sm:text-sm">Present</dt>
              <dd className="mt-0.5 truncate text-[15px] font-semibold text-success tnum sm:mt-1 sm:text-base">
                {counters.present}
              </dd>
            </div>
            <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
              <dt className="text-xs text-text-muted sm:text-sm">Half Day</dt>
              <dd className="mt-0.5 truncate text-[15px] font-semibold text-amber-600 tnum sm:mt-1 sm:text-base">
                {counters.halfDay}
              </dd>
            </div>
            <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
              <dt className="text-xs text-text-muted sm:text-sm">Absent</dt>
              <dd className="mt-0.5 truncate text-[15px] font-semibold text-danger tnum sm:mt-1 sm:text-base">
                {counters.absent}
              </dd>
            </div>
          </dl>
        )}
      </Card>

      {/* Phone: search + completion on one row, site + status below. */}
      <div className="flex flex-col gap-2 sm:hidden">
        <div className="flex flex-row gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            />
            <Input
              aria-label="Search labour"
              placeholder="Search labour…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-10"
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch("")}
                className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-text-muted hover:bg-background hover:text-text"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="w-[132px] shrink-0">
            <ComboSelect
              ariaLabel="Filter by completion"
              value={completion}
              options={[
                { value: "all", label: "All" },
                { value: "remaining", label: "Not Marked" },
                { value: "marked", label: "Marked" },
              ]}
              onChange={(v) =>
                setCompletion(v as "all" | "remaining" | "marked")
              }
            />
          </div>
        </div>
        <div className="flex flex-row gap-2">
          <div className="min-w-0 flex-1">
            <ComboSelect
              ariaLabel="Filter by site"
              value={siteFilter}
              options={[
                { value: "all", label: "All Sites" },
                { value: "none", label: "No Site" },
                ...sites.map((s) => ({ value: s._id, label: s.name })),
              ]}
              onChange={(v) => setSiteFilter(v)}
            />
          </div>
          <div className="w-[132px] shrink-0">
            <ComboSelect
              ariaLabel="Filter by status"
              value={statusFilter}
              options={[
                { value: "all", label: "All" },
                { value: "present", label: "Present" },
                { value: "half-day", label: "Half Day" },
                { value: "absent", label: "Absent" },
              ]}
              onChange={(v) => setStatusFilter(v)}
            />
          </div>
        </div>
        {hasActiveFilters && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        )}
      </div>

      {/* Desktop: original row, selects swapped to ComboSelect popups. */}
      <div className="hidden sm:flex sm:flex-row sm:gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search name, phone, skill..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search labour"
          />
        </div>
        <div className="w-44 shrink-0">
          <ComboSelect
            ariaLabel="Completion filter"
            value={completion}
            options={[
              { value: "all", label: "All" },
              { value: "remaining", label: "Not Marked" },
              { value: "marked", label: "Marked" },
            ]}
            onChange={(v) => setCompletion(v as "all" | "remaining" | "marked")}
          />
        </div>
        <div className="w-44 shrink-0">
          <ComboSelect
            ariaLabel="Status filter"
            value={statusFilter}
            options={[
              { value: "all", label: "All Statuses" },
              { value: "present", label: "Present" },
              { value: "half-day", label: "Half Day" },
              { value: "absent", label: "Absent" },
            ]}
            onChange={(v) => setStatusFilter(v)}
          />
        </div>
        <div className="w-44 shrink-0">
          <ComboSelect
            ariaLabel="Site filter"
            value={siteFilter}
            options={[
              { value: "all", label: "All Sites" },
              { value: "none", label: "No Site" },
              ...sites.map((s) => ({ value: s._id, label: s.name })),
            ]}
            onChange={(v) => setSiteFilter(v)}
          />
        </div>
        <div className="flex items-center justify-end">
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Phone: compact bulk bar. */}
      <div className="sm:hidden">
        <Card className="rounded-xl p-2.5">
          <div className="flex items-center gap-2">
            {/* Selected count */}
            <div className="min-w-0 flex-1">
              <span className="text-xs text-text-muted">
                Selected{" "}
                <span className="font-semibold text-text tnum">
                  {selectedCount}
                </span>
              </span>
            </div>

            {/* Bulk actions */}
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                size="sm"
                disabled={selectedCount === 0 || saving}
                onClick={() => handleSelectedBulk("present")}
                className="h-8 px-2.5 text-[11px]"
              >
                Present
              </Button>

              <Button
                size="sm"
                disabled={selectedCount === 0 || saving}
                onClick={() => handleSelectedBulk("half-day")}
                className="h-8 px-2.5 text-[11px]"
              >
                Half
              </Button>

              <Button
                size="sm"
                disabled={selectedCount === 0 || saving}
                onClick={() => handleSelectedBulk("absent")}
                className="h-8 px-2.5 text-[11px]"
              >
                Absent
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Desktop: original bulk bar, untouched. */}
      <div className="hidden sm:block">
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">
              Selected: {selectedCount}
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                disabled={selectedCount === 0 || saving}
                onClick={() => handleSelectedBulk("present")}
              >
                Present
              </Button>
              <Button
                size="sm"
                disabled={selectedCount === 0 || saving}
                onClick={() => handleSelectedBulk("half-day")}
              >
                Half Day
              </Button>
              <Button
                size="sm"
                disabled={selectedCount === 0 || saving}
                onClick={() => handleSelectedBulk("absent")}
              >
                Absent
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {loading && (
        <div className="text-sm text-text-muted">Loading roster...</div>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}{" "}
          <button type="button" className="underline" onClick={fetchRoster}>
            Retry
          </button>
        </p>
      )}

      {!loading && !error && filtered.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-sm text-text-muted">
            No labour matches current filters.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={clearFilters}
          >
            Clear filters
          </Button>
        </Card>
      )}

      {!loading && !error && filtered.length > 0 && (
        <>
          {/* =========================================
              DESKTOP VIEW: SCROLLABLE TABLE 
             ========================================= */}
          <div className="hidden scroll-area overflow-x-auto sm:block">
            <Table>
              <THead>
                <TR>
                  <TH className="w-10 text-center">
                    <label className="inline-flex cursor-pointer items-center justify-center">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={toggleSelectAllPage}
                        aria-label="Select all on this page"
                        className="peer sr-only"
                      />
                      <span
                        className={cn(
                          "inline-flex h-4 w-4 items-center justify-center rounded-[4px] border-2 transition-colors",
                          allPageSelected
                            ? "border-primary bg-primary text-white"
                            : "border-border bg-surface",
                        )}
                      >
                        {allPageSelected && (
                          <Check className="h-3 w-3 text-white" />
                        )}
                      </span>
                    </label>
                  </TH>
                  <TH>Labour</TH>
                  <TH>Site</TH>
                  <TH>Status</TH>
                  <TH>Actions</TH>
                </TR>
              </THead>
              <tbody>
                {paginated.map((item) => {
                  const isSelected = selected.has(item.labour._id);
                  const att = item.attendance;
                  const pendingVal = pendingSite[item.labour._id];
                  const hasPending = pendingVal !== undefined;
                  const isSiteSaving = att ? siteSavingId === att._id : false;
                  const isSiteSaved = att ? siteSavedId === att._id : false;
                  return (
                    <TR
                      key={item.labour._id}
                      className={cn(
                        isSelected && "bg-primary/5",
                        "cursor-pointer hover:bg-background/70",
                      )}
                      onClick={() =>
                        router.push(`/dashboard/labour/${item.labour._id}`)
                      }
                    >
                      <TD
                        className="text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <label className="inline-flex cursor-pointer items-center justify-center p-1 sm:p-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(item.labour._id)}
                            aria-label={`Select ${item.labour.name}`}
                            className="peer sr-only"
                          />
                          <span
                            className={cn(
                              "inline-flex h-4 w-4 items-center justify-center rounded-[4px] border-2 transition-colors",
                              isSelected
                                ? "border-primary bg-primary text-white"
                                : "border-border bg-surface",
                            )}
                          >
                            {isSelected && (
                              <Check className="h-3 w-3 text-white" />
                            )}
                          </span>
                        </label>
                      </TD>
                      <TD>
                        <div className="text-[15px] font-medium text-primary sm:text-sm">
                          {item.labour.name}
                        </div>
                        <div className="text-xs text-text-muted">
                          {item.labour.skill}
                        </div>
                      </TD>
                      <TD onClick={(e) => e.stopPropagation()}>
                        {att ? (
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <ComboSelect
                              ariaLabel={`Site for ${item.labour.name}`}
                              value={
                                siteIdOf(
                                  att.site as
                                    | string
                                    | { _id: string; name: string },
                                ) ?? "__none"
                              }
                              options={[
                                { value: "__none", label: "No Site" },
                                ...sites.map((s) => ({
                                  value: s._id,
                                  label: s.name,
                                })),
                              ]}
                              onChange={(v) => {
                                handleSiteAutoSave(
                                  item,
                                  v === "__none" ? null : v,
                                );
                              }}
                              triggerClassName="h-8 px-2 text-sm sm:h-8"
                            />
                            {isSiteSaving ? (
                              <span className="text-xs text-text-muted">
                                Saving…
                              </span>
                            ) : isSiteSaved ? (
                              <span className="text-xs text-success">
                                ✓ Saved
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <ComboSelect
                            ariaLabel={`Site for ${item.labour.name}`}
                            value={
                              hasPending
                                ? (pendingVal ?? "__none")
                                : (item.suggestedSite?._id ?? "__none")
                            }
                            options={[
                              { value: "__none", label: "No Site" },
                              ...sites.map((s) => ({
                                value: s._id,
                                label: s.name,
                              })),
                            ]}
                            onChange={(v) => {
                              const value = v === "__none" ? null : v;
                              setPendingSite((prev) => ({
                                ...prev,
                                [item.labour._id]: value,
                              }));
                            }}
                            triggerClassName="h-8 px-2 text-sm sm:h-8"
                          />
                        )}
                      </TD>
                      <TD>
                        {att ? (
                          <Badge tone={STATUS_TONE[att.status]}>
                            {STATUS_LABEL[att.status]}
                          </Badge>
                        ) : (
                          <Badge tone="neutral">Not Marked</Badge>
                        )}
                      </TD>
                      <TD onClick={(e) => e.stopPropagation()}>
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              aria-label="Present"
                              title="Present"
                              onClick={() => markOne(item, "present")}
                              disabled={saving}
                              className={cn(
                                "inline-flex h-9 w-9 items-center justify-center rounded-md sm:h-8 sm:w-8",
                                att?.status === "present"
                                  ? "bg-primary text-white"
                                  : "text-text-muted hover:bg-primary/10 hover:text-primary",
                              )}
                            >
                              <UserCheck className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              aria-label="Half Day"
                              title="Half Day"
                              onClick={() => markOne(item, "half-day")}
                              disabled={saving}
                              className={cn(
                                "inline-flex h-9 w-9 items-center justify-center rounded-md sm:h-8 sm:w-8",
                                att?.status === "half-day"
                                  ? "bg-amber-500 text-white"
                                  : "text-text-muted hover:bg-amber-500/10 hover:text-amber-600",
                              )}
                            >
                              <UserRoundMinus className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              aria-label="Absent"
                              title="Absent"
                              onClick={() => markOne(item, "absent")}
                              disabled={saving}
                              className={cn(
                                "inline-flex h-9 w-9 items-center justify-center rounded-md sm:h-8 sm:w-8",
                                att?.status === "absent"
                                  ? "bg-danger text-white"
                                  : "text-text-muted hover:bg-danger/10 hover:text-danger",
                              )}
                            >
                              <UserRoundX className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="flex items-center gap-1">
                            {item.overtime ? (
                              <button
                                type="button"
                                aria-label="Edit overtime"
                                title={`OT ${item.overtime.hours}h → Edit`}
                                onClick={() => {
                                  if (!att) return;
                                  setOtItem(item);
                                  setOtEditing({
                                    _id: item.overtime!._id,
                                    hours: item.overtime!.hours,
                                    rate: item.overtime!.rate,
                                    notes: item.overtime!.notes,
                                    site: item.overtime!.site,
                                  });
                                }}
                                disabled={!att}
                                className="inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-md bg-primary px-2 text-white hover:bg-primary/90 sm:h-8 sm:min-w-8"
                              >
                                <span className="text-xs font-semibold">
                                  +{item.overtime.hours}h
                                </span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                aria-label="Add overtime"
                                title={
                                  !att ? "Mark attendance first" : "Add OT"
                                }
                                onClick={() => {
                                  if (!att) return;
                                  setOtItem(item);
                                  setOtEditing(null);
                                }}
                                disabled={!att}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-primary/10 hover:text-primary disabled:opacity-40 sm:h-8 sm:w-8"
                              >
                                <ClockPlus className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              aria-label="Delete attendance"
                              title="Delete attendance (also deletes OT)"
                              onClick={() => {
                                if (!att) return;
                                setDeleteTarget(item);
                              }}
                              disabled={!att}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-40 sm:h-8 sm:w-8"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </div>

          {/* =========================================
              MOBILE VIEW: COMPACT MUSTER LIST
             ========================================= */}
       <div className="sm:hidden">
            {/* Select All */}
            <div className="mb-2 flex h-10 items-center justify-between px-3">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={toggleSelectAllPage}
                  aria-label="Select all on this page"
                  className="sr-only"
                />
                <span
                  className={cn(
                    "inline-flex h-[18px] w-[18px] items-center justify-center rounded-[4px] border transition-colors",
                    allPageSelected
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-surface",
                  )}
                >
                  {allPageSelected && <Check className="h-3 w-3" />}
                </span>
                <span className="text-xs font-medium text-text">Select all</span>
              </label>

              {selectedCount > 0 && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary tnum">
                  {selectedCount} selected
                </span>
              )}
            </div>

            {/* Roster */}
            <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
              {paginated.map((item, index) => {
                const isSelected = selected.has(item.labour._id);
                const att = item.attendance;
                const pendingVal = pendingSite[item.labour._id];
                const hasPending = pendingVal !== undefined;
                const siteValue = hasPending
                  ? (pendingVal ?? "__none")
                  : att
                    ? (siteIdOf(att.site as string | { _id: string; name: string }) ?? "__none")
                    : (item.suggestedSite?._id ?? "__none");

                const isSiteSaving = att ? siteSavingId === att._id : false;
                const isSiteSaved = att ? siteSavedId === att._id : false;

                return (
                  <div
                    key={item.labour._id}
                    className={cn(
                      "px-3 py-3",
                      index > 0 && "border-t border-border",
                      isSelected && "bg-primary/[0.025]"
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Checkbox */}
                      <label className="mt-0.5 shrink-0 cursor-pointer p-0.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(item.labour._id)}
                          aria-label={`Select ${item.labour.name}`}
                          className="sr-only"
                        />
                        <span
                          className={cn(
                            "inline-flex h-[18px] w-[18px] items-center justify-center rounded-[4px] border transition-colors",
                            isSelected
                              ? "border-primary bg-primary text-white"
                              : "border-border bg-surface",
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </span>
                      </label>

                      <div className="min-w-0 flex-1">
                        {/* Top Row: Clickable Name + Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => router.push(`/dashboard/labour/${item.labour._id}`)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="truncate text-[14px] font-semibold leading-tight text-primary">
                              {item.labour.name}
                            </div>
                            <div className="mt-0.5 truncate text-xs text-text-muted">
                              {item.labour.skill}
                            </div>
                          </button>
                          
                          <div className="shrink-0 pt-0.5">
                            {att ? (
                              <Badge tone={STATUS_TONE[att.status]} className="px-1.5 py-0.5 text-[9px]">
                                {STATUS_LABEL[att.status]}
                              </Badge>
                            ) : (
                              <Badge tone="neutral" className="px-1.5 py-0.5 text-[9px]">
                                Not Marked
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Middle Row: Native OS Site Dropdown (Fixed for touch) */}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="relative flex max-w-[160px] flex-1 items-center">
                            <select
                              aria-label={`Site for ${item.labour.name}`}
                              value={siteValue}
                              onChange={(e) => {
                                const value = e.target.value === "__none" ? null : e.target.value;
                                if (att) handleSiteAutoSave(item, value);
                                else setPendingSite((prev) => ({ ...prev, [item.labour._id]: value }));
                              }}
                              className={cn(
                                "h-7 w-full appearance-none truncate rounded-md border border-border bg-background pl-2 pr-7 text-xs font-medium focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20",
                                siteValue === "__none" ? "text-text-muted" : "text-text"
                              )}
                            >
                              <option value="__none">No site</option>
                              {sites.map((s) => (
                                <option key={s._id} value={s._id}>{s.name}</option>
                              ))}
                            </select>
                            {/* Custom arrow overlay to hide the ugly default browser dropdown arrow */}
                            <svg className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>

                          {isSiteSaving && (
                            <span className="shrink-0 text-[10px] animate-pulse text-text-muted">Saving…</span>
                          )}
                          {isSiteSaved && !isSiteSaving && (
                            <span className="shrink-0 text-[10px] font-medium text-success">✓ Saved</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: Actions */}
                    <div className="mt-3 flex items-center gap-1.5 pl-[34px]">
                      {/* Attendance Buttons */}
                      <div
                        className="flex min-w-0 flex-1 overflow-hidden rounded-md border border-border bg-background shadow-sm"
                        role="group"
                        aria-label={`Attendance for ${item.labour.name}`}
                      >
                        <button
                          type="button"
                          onClick={() => markOne(item, "present")}
                          disabled={saving}
                          className={cn(
                            "h-9 min-w-0 flex-1 px-1 text-[11px] font-semibold transition-colors",
                            att?.status === "present"
                              ? "bg-primary text-white"
                              : "text-text-muted hover:bg-primary/5 hover:text-primary"
                          )}
                        >
                          Present
                        </button>
                        <button
                          type="button"
                          onClick={() => markOne(item, "half-day")}
                          disabled={saving}
                          className={cn(
                            "h-9 min-w-0 flex-1 border-x border-border px-1 text-[11px] font-semibold transition-colors",
                            att?.status === "half-day"
                              ? "bg-amber-500 text-white"
                              : "text-text-muted hover:bg-amber-500/5 hover:text-amber-600"
                          )}
                        >
                          Half
                        </button>
                        <button
                          type="button"
                          onClick={() => markOne(item, "absent")}
                          disabled={saving}
                          className={cn(
                            "h-9 min-w-0 flex-1 px-1 text-[11px] font-semibold transition-colors",
                            att?.status === "absent"
                              ? "bg-danger text-white"
                              : "text-text-muted hover:bg-danger/5 hover:text-danger"
                          )}
                        >
                          Absent
                        </button>
                      </div>

                      {/* Overtime Button */}
                      {item.overtime ? (
                        <button
                          type="button"
                          aria-label="Edit overtime"
                          title={`OT ${item.overtime.hours}h`}
                          onClick={() => {
                            if (!att) return;
                            setOtItem(item);
                            setOtEditing({
                              _id: item.overtime!._id,
                              hours: item.overtime!.hours,
                              rate: item.overtime!.rate,
                              notes: item.overtime!.notes,
                              site: item.overtime!.site,
                            });
                          }}
                          disabled={!att}
                          className="inline-flex h-9 shrink-0 items-center justify-center rounded-md bg-primary px-2.5 text-[11px] font-bold text-white shadow-sm disabled:opacity-40"
                        >
                          +{item.overtime.hours}h
                        </button>
                      ) : (
                        <button
                          type="button"
                          aria-label="Add overtime"
                          title={!att ? "Mark attendance first" : "Add OT"}
                          onClick={() => {
                            if (!att) return;
                            setOtItem(item);
                            setOtEditing(null);
                          }}
                          disabled={!att}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-text-muted shadow-sm transition-colors hover:bg-primary/5 hover:text-primary disabled:opacity-40"
                        >
                          <ClockPlus className="h-[18px] w-[18px]" />
                        </button>
                      )}

                      {/* Delete Button */}
                      <button
                        type="button"
                        aria-label="Delete attendance"
                        title="Delete attendance"
                        onClick={() => {
                          if (!att) return;
                          setDeleteTarget(item);
                        }}
                        disabled={!att}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-text-muted shadow-sm transition-colors hover:bg-danger/5 hover:text-danger disabled:opacity-40"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted sm:text-sm">
            <p className="tnum">
              {filtered.length} workers(s) · Page {page} of {totalPages}
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

      {otItem && (
        <AttendanceOtModal
          open={!!otItem}
          onClose={() => {
            setOtItem(null);
            setOtEditing(null);
          }}
          onSaved={() => {
            fetchRoster();
            onOtChange?.();
          }}
          labour={otItem.labour}
          date={date}
          sites={sites}
          suggestedSiteId={
            otItem.attendance
              ? siteIdOf(
                  otItem.attendance.site as
                    | string
                    | { _id: string; name: string },
                )
              : (otItem.suggestedSite?._id ?? null)
          }
          existing={otEditing}
        />
      )}

      <ConfirmDialog
        open={!!confirmBulk}
        onClose={() => setConfirmBulk(null)}
        onConfirm={confirmMarkAllBelow}
        title={`Change ${confirmBulk?.count} records?`}
        description={
          confirmBulk?.overwriteCount
            ? `You are about to change ${confirmBulk.overwriteCount} existing records and create ${confirmBulk.count - confirmBulk.overwriteCount} new ones to "${confirmBulk?.status}". Continue?`
            : `Mark ${confirmBulk?.count} labour as ${confirmBulk?.status}?`
        }
        pending={saving}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remove attendance?"
        description={
          deleteTarget
            ? `This will remove ${deleteTarget.labour.name}'s attendance for ${formatDateShort(date)} and return it to Not Marked. Overtime for this date will also be deleted.`
            : undefined
        }
        confirmLabel="Remove Attendance"
        pending={deletePending}
      />
    </div>
  );
}
