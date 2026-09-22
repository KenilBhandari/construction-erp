"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/modal";
import { formatDateShort, toDateInputValue } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { AttendanceStatus } from "@/types/attendance";
import type { SiteDTO } from "@/types/site";
import { AttendanceDayDetail } from "./attendance-day-detail";
import { AttendanceOtModal } from "./attendance-ot-modal";

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

const STATUS_TONE: Record<AttendanceStatus, "success" | "warning" | "danger"> = {
  present: "success",
  "half-day": "warning",
  absent: "danger",
};

function siteNameOf(site: string | { _id: string; name: string } | null | undefined): string | null {
  if (!site) return null;
  return typeof site === "string" ? site : site.name;
}

function attendanceSiteName(att: RosterItem["attendance"]): string | null {
  if (!att?.site) return null;
  return siteNameOf(att.site as string | { _id: string; name: string });
}

function siteIdOf(site: string | { _id: string; name: string } | null | undefined): string | null {
  if (!site) return null;
  return typeof site === "string" ? site : (site as { _id: string })._id;
}

export function AttendanceMuster({ onOtChange }: { onOtChange?: () => void } = {}) {
  const [date, setDate] = useState(() => toDateInputValue());
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState<string>("all"); // all | siteId | "none"
  const [statusFilter, setStatusFilter] = useState<string>("all"); // all | present | half-day | absent
  const [completion, setCompletion] = useState<"all" | "remaining" | "marked">("all");
  const [roster, setRoster] = useState<RosterItem[] | null>(null);
  const [counters, setCounters] = useState<{ total: number; marked: number; remaining: number; present: number; halfDay: number; absent: number } | null>(null);
  const [sites, setSites] = useState<{ _id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [bulkSite, setBulkSite] = useState<string>("__none"); // for bulk site choice
  const [confirmBulk, setConfirmBulk] = useState<{ status: AttendanceStatus; mode: "remaining" | "allBelow" | "selected"; count: number; overwriteCount?: number } | null>(null);

  // New UX states
  const [pendingSite, setPendingSite] = useState<Record<string, string | null>>({});
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [siteSavingId, setSiteSavingId] = useState<string | null>(null);
  const [siteSavedId, setSiteSavedId] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<RosterItem | null>(null);
  const [otItem, setOtItem] = useState<RosterItem | null>(null);
  const [otEditing, setOtEditing] = useState<{ _id: string; hours: number; rate: number; notes: string | null } | null>(null);
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
      setCounters({ total: j.total, marked: j.marked, remaining: j.remaining, present: j.present, halfDay: j.halfDay, absent: j.absent });
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
          if (r.ok && Array.isArray(j.data)) setSites(j.data.map((s: SiteDTO) => ({ _id: s._id, name: s.name })));
        })
        .catch(() => {});
    }
  }, [sites.length]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(new Set());
  }, [date, search, siteFilter, statusFilter, completion]);

  // Clear pending sites when date changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingSite({});
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditingSiteId(null);
  }, [date]);

  // Keep detailItem in sync with latest roster (so OT/site changes reflect immediately)
  useEffect(() => {
    if (!detailItem || !roster) return;
    const fresh = roster.find((r) => r.labour._id === detailItem.labour._id);
    if (fresh && fresh !== detailItem) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDetailItem(fresh);
    }
  }, [roster, detailItem]);

  const filtered = useMemo(() => {
    if (!roster) return [];
    let out = roster;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((r) => r.labour.name.toLowerCase().includes(q) || r.labour.phone.toLowerCase().includes(q) || r.labour.skill.toLowerCase().includes(q));
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

  const allVisibleSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.labour._id));
  const selectedCount = selected.size;

  const toggleSelect = (labourId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(labourId)) next.delete(labourId);
      else next.add(labourId);
      return next;
    });
  };

  const selectAllVisible = () => {
    if (allVisibleSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.labour._id)));
  };

  const clearFilters = () => {
    setSearch("");
    setSiteFilter("all");
    setStatusFilter("all");
    setCompletion("all");
  };

  const hasActiveFilters = search.trim() !== "" || siteFilter !== "all" || statusFilter !== "all" || completion !== "all";

  const handleSiteAutoSave = async (item: RosterItem, newSiteId: string | null) => {
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
      setTimeout(() => setSiteSavedId((prev) => (prev === item.attendance?._id ? null : prev)), 2000);
      setEditingSiteId(null);
      await fetchRoster();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSiteSavingId(null);
    }
  };

  const markOne = async (item: RosterItem, status: AttendanceStatus) => {
    setSaving(true);
    try {
      let site: string | null = null;
      if (item.attendance) {
        site = siteIdOf(item.attendance.site as string | { _id: string; name: string });
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
          records: [{ labour: item.labour._id, status, site, notes: item.attendance?.notes ?? null }],
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
    let siteForBulk: string | null = null;
    if (siteFilter !== "all" && siteFilter !== "none") siteForBulk = siteFilter;
    else if (siteFilter === "none") siteForBulk = null;
    else siteForBulk = bulkSite === "__none" ? null : bulkSite;

    setSaving(true);
    try {
      const records = remaining.map((r) => {
        const pending = pendingSite[r.labour._id];
        const site = pending !== undefined ? pending : r.suggestedSite?._id ?? siteForBulk;
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
      setConfirmBulk({ status, mode: "allBelow", count: filtered.length, overwriteCount });
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
      let siteForBulk: string | null = null;
      if (siteFilter !== "all" && siteFilter !== "none") siteForBulk = siteFilter;
      else siteForBulk = bulkSite === "__none" ? null : bulkSite;
      const records = filtered.map((r) => {
        const pending = pendingSite[r.labour._id];
        const site = r.attendance ? siteIdOf(r.attendance.site as string | { _id: string; name: string }) : pending !== undefined ? pending : r.suggestedSite?._id ?? siteForBulk;
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
    let siteForBulk: string | null = null;
    if (siteFilter !== "all" && siteFilter !== "none") siteForBulk = siteFilter;
    else siteForBulk = bulkSite === "__none" ? null : bulkSite;
    setSaving(true);
    try {
      const records = items.map((r) => {
        const pending = pendingSite[r.labour._id];
        const site = r.attendance ? siteIdOf(r.attendance.site as string | { _id: string; name: string }) : pending !== undefined ? pending : r.suggestedSite?._id ?? siteForBulk;
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
      const res = await fetch(`/api/attendance/${deleteTarget.attendance._id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Delete failed");
      setDeleteTarget(null);
      setDetailItem(null);
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
      <Card className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-text">Attendance — {formatDateShort(date)}</h2>
            <p className="text-sm text-text-muted">Muster for the selected date. Not Marked = no record yet.</p>
          </div>
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="sm:w-48" />
        </div>

        {counters && (
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm sm:grid-cols-6">
            <div><dt className="text-text-muted">Total Labour</dt><dd className="font-semibold tnum">{counters.total}</dd></div>
            <div><dt className="text-text-muted">Marked</dt><dd className="font-semibold tnum">{counters.marked}</dd></div>
            <div><dt className="text-text-muted">Remaining</dt><dd className="font-semibold tnum">{counters.remaining}</dd></div>
            <div><dt className="text-text-muted">Present</dt><dd className="font-semibold tnum text-success">{counters.present}</dd></div>
            <div><dt className="text-text-muted">Half Day</dt><dd className="font-semibold tnum text-amber-600">{counters.halfDay}</dd></div>
            <div><dt className="text-text-muted">Absent</dt><dd className="font-semibold tnum text-danger">{counters.absent}</dd></div>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
          <Input placeholder="Search name, phone, skill..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search labour" />
          <Select value={completion} onChange={(e) => setCompletion(e.target.value as never)} aria-label="Completion filter">
            <option value="all">All</option>
            <option value="remaining">Remaining</option>
            <option value="marked">Marked</option>
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Status filter">
            <option value="all">All Statuses</option>
            <option value="present">Present</option>
            <option value="half-day">Half Day</option>
            <option value="absent">Absent</option>
          </Select>
          <Select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)} aria-label="Site filter">
            <option value="all">All Sites</option>
            <option value="none">No Site</option>
            {sites.map((s) => (<option key={s._id} value={s._id}>{s.name}</option>))}
          </Select>
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-muted tnum">Showing {filtered.length} of {counters?.total ?? 0}</span>
            {hasActiveFilters && <Button variant="outline" size="sm" onClick={clearFilters}>Clear</Button>}
          </div>
        </div>
        {hasActiveFilters && (
          <p className="mt-2 text-xs text-text-muted">
            Filters: {[
              completion !== "all" && completion,
              statusFilter !== "all" && STATUS_LABEL[statusFilter as AttendanceStatus],
              siteFilter !== "all" && (siteFilter === "none" ? "No Site" : sites.find((s) => s._id === siteFilter)?.name ?? siteFilter),
              search.trim() && `"${search.trim()}"`,
            ].filter(Boolean).join(" · ")}
          </p>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex flex-col gap-3">
    
      
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Selected: {selectedCount}</span>
            <Button size="sm" variant="outline" onClick={selectAllVisible} disabled={filtered.length === 0}>
              {allVisibleSelected ? "Clear selection" : `Select all ${filtered.length}`}
            </Button>
            <Button size="sm" disabled={selectedCount === 0 || saving} onClick={() => handleSelectedBulk("present")}>Present</Button>
            <Button size="sm" disabled={selectedCount === 0 || saving} onClick={() => handleSelectedBulk("half-day")}>Half Day</Button>
            <Button size="sm" disabled={selectedCount === 0 || saving} onClick={() => handleSelectedBulk("absent")}>Absent</Button>
          </div>
        </div>
      </Card>

      {loading && <div className="text-sm text-text-muted">Loading roster...</div>}
      {error && <p role="alert" className="text-sm text-danger">{error} <button type="button" className="underline" onClick={fetchRoster}>Retry</button></p>}

      {!loading && !error && filtered.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-sm text-text-muted">No labour matches current filters.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters}>Clear filters</Button>
        </Card>
      )}

      {!loading && !error && filtered.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH><input type="checkbox" checked={allVisibleSelected} onChange={selectAllVisible} aria-label="Select all" /></TH>
                  <TH>Labour</TH>
                  <TH>Site</TH>
                  <TH>Status</TH>
                  <TH>Action</TH>
                </TR>
              </THead>
              <tbody>
                {filtered.map((item) => {
                  const isSelected = selected.has(item.labour._id);
                  const att = item.attendance;
                  const siteName = att ? attendanceSiteName(att) : null;
                  const pendingVal = pendingSite[item.labour._id];
                  const hasPending = pendingVal !== undefined;
                  const isSiteSaving = att ? siteSavingId === att._id : false;
                  const isSiteSaved = att ? siteSavedId === att._id : false;
                  return (
                    <TR key={item.labour._id} className={cn(isSelected && "bg-primary/5", "cursor-pointer hover:bg-background")} onClick={() => setDetailItem(item)}>
                      <TD onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(item.labour._id)} aria-label={`Select ${item.labour.name}`} />
                      </TD>
                      <TD onClick={(e) => e.stopPropagation()}>
                        <Link href={`/dashboard/labour/${item.labour._id}`} className="font-medium text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                          {item.labour.name}
                        </Link>
                        <div className="text-xs text-text-muted tnum">{item.labour.skill} · {item.labour.phone}</div>
                      </TD>
                      <TD onClick={(e) => e.stopPropagation()}>
                        {att ? (
                          editingSiteId === att._id ? (
                            <div className="flex items-center gap-1">
                              <select
                                autoFocus
                                value={siteIdOf(att.site as string | { _id: string; name: string }) ?? "__none"}
                                onChange={(e) => {
                                  const v = e.target.value === "__none" ? null : e.target.value;
                                  handleSiteAutoSave(item, v);
                                }}
                                disabled={isSiteSaving}
                                className="rounded-md border border-primary bg-surface px-2 py-1 text-sm"
                              >
                                <option value="__none">No Site</option>
                                {sites.map((s) => (<option key={s._id} value={s._id}>{s.name}</option>))}
                              </select>
                              <button type="button" className="text-xs text-text-muted hover:text-text" onClick={() => setEditingSiteId(null)}>✕</button>
                            </div>
                          ) : (
                            <div className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm", isSiteSaved ? "border-success bg-success/10" : "border-border bg-background")}>
                              <span className={cn(isSiteSaved && "text-success font-medium")}>{siteName ?? "No Site"}</span>
                              {isSiteSaving ? <span className="text-xs text-text-muted">Saving…</span> : isSiteSaved ? <span className="text-xs text-success">✓ Saved</span> : null}
                              <button
                                type="button"
                                title="Change site"
                                className="ml-1 rounded p-0.5 text-text-muted hover:bg-border hover:text-text"
                                onClick={() => setEditingSiteId(att._id)}
                              >
                                {/* reset/edit icon */}
                                <span className="text-xs">✎</span>
                              </button>
                            </div>
                          )
                        ) : (
                          <select
                            value={hasPending ? (pendingVal ?? "__none") : (item.suggestedSite?._id ?? "__none")}
                            onChange={(e) => {
                              const v = e.target.value === "__none" ? null : e.target.value;
                              setPendingSite((prev) => ({ ...prev, [item.labour._id]: v }));
                            }}
                            className="h-8 rounded-md border border-border bg-surface px-2 text-sm focus:border-primary focus:outline-none"
                          >
                            <option value="__none">No Site</option>
                            {sites.map((s) => (<option key={s._id} value={s._id}>{s.name}</option>))}
                          </select>
                        )}
                      </TD>
                      <TD>
                        {att ? <Badge tone={STATUS_TONE[att.status]}>{STATUS_LABEL[att.status]}</Badge> : <Badge tone="neutral">Not Marked</Badge>}
                      </TD>
                      <TD onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap gap-1">
                          <Button size="sm" variant={att?.status === "present" ? "primary" : "outline"} onClick={() => markOne(item, "present")} disabled={saving}>Present</Button>
                          <Button size="sm" variant={att?.status === "half-day" ? "primary" : "outline"} onClick={() => markOne(item, "half-day")} disabled={saving}>Half</Button>
                          <Button size="sm" variant={att?.status === "absent" ? "primary" : "outline"} onClick={() => markOne(item, "absent")} disabled={saving}>Absent</Button>
                          {item.overtime ? (
                            <Button size="sm" variant="primary" onClick={() => { if (!att) return; setOtItem(item); setOtEditing({ _id: item.overtime!._id, hours: item.overtime!.hours, rate: item.overtime!.rate, notes: item.overtime!.notes }); }} disabled={!att} title={`OT ${item.overtime.hours}h @ ${item.overtime.rate} → Edit`}>
                              OT {item.overtime.hours}h
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => { if (!att) return; setOtItem(item); setOtEditing(null); }} disabled={!att} title={!att ? "Mark attendance first" : "Add OT"}>
                              + OT
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => { if (!att) return; setDeleteTarget(item); }} disabled={!att} title="Delete attendance (also deletes OT)">
                            X
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </Card>
      )}

      {detailItem && (
        <AttendanceDayDetail
          open={!!detailItem}
          onClose={() => setDetailItem(null)}
          item={detailItem}
          date={date}
          sites={sites}
          onSiteSaved={async () => { await fetchRoster(); onOtChange?.(); }}
        />
      )}

      {otItem && (
        <AttendanceOtModal
          open={!!otItem}
          onClose={() => { setOtItem(null); setOtEditing(null); }}
          onSaved={() => { fetchRoster(); onOtChange?.(); }}
          labour={otItem.labour}
          date={date}
          sites={sites}
          suggestedSiteId={otItem.attendance ? siteIdOf(otItem.attendance.site as string | { _id: string; name: string }) : otItem.suggestedSite?._id ?? null}
          existing={otEditing}
        />
      )}

      <ConfirmDialog
        open={!!confirmBulk}
        onClose={() => setConfirmBulk(null)}
        onConfirm={confirmMarkAllBelow}
        title={`Change ${confirmBulk?.count} records?`}
        description={confirmBulk?.overwriteCount ? `You are about to change ${confirmBulk.overwriteCount} existing records and create ${confirmBulk.count - confirmBulk.overwriteCount} new ones to "${confirmBulk?.status}". Continue?` : `Mark ${confirmBulk?.count} labour as ${confirmBulk?.status}?`}
        pending={saving}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remove attendance?"
        description={deleteTarget ? `This will remove ${deleteTarget.labour.name}'s attendance for ${formatDateShort(date)} and return it to Not Marked. Overtime for this date will also be deleted.` : undefined}
        confirmLabel="Remove Attendance"
        pending={deletePending}
      />
    </div>
  );
}
