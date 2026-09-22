"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { formatDateShort, toDateInputValue } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { AttendanceStatus } from "@/types/attendance";
import type { SiteDTO } from "@/types/site";

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
}

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

export function AttendanceMuster() {
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
  const [editing, setEditing] = useState<RosterItem | null>(null);
  const [bulkSite, setBulkSite] = useState<string>("__none"); // for bulk site choice
  const [confirmBulk, setConfirmBulk] = useState<{ status: AttendanceStatus; mode: "remaining" | "allBelow" | "selected"; count: number; overwriteCount?: number } | null>(null);

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

  // Also fetch sites for bulk site selector (if roster sites not enough)
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

  // Reset selection when filters change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(new Set());
  }, [date, search, siteFilter, statusFilter, completion]);

  const filtered = useMemo(() => {
    if (!roster) return [];
    let out = roster;
    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((r) => r.labour.name.toLowerCase().includes(q) || r.labour.phone.toLowerCase().includes(q) || r.labour.skill.toLowerCase().includes(q));
    }
    // Completion
    if (completion === "remaining") out = out.filter((r) => !r.attendance);
    else if (completion === "marked") out = out.filter((r) => !!r.attendance);
    // Status
    if (statusFilter !== "all") {
      out = out.filter((r) => r.attendance?.status === statusFilter);
    }
    // Site
    if (siteFilter !== "all") {
      if (siteFilter === "none") {
        out = out.filter((r) => r.attendance && !r.attendance.site);
      } else {
        // For remaining, filter by suggestedSite; for marked, filter by attendance.site
        out = out.filter((r) => {
          if (!r.attendance) {
            // Not marked: use suggestedSite for filtering if available
            return r.suggestedSite?._id === siteFilter;
          }
          const s = r.attendance.site;
          const sid = s ? (typeof s === "string" ? s : (s as { _id: string })._id) : null;
          return sid === siteFilter;
        });
      }
    }
    return out;
  }, [roster, search, siteFilter, statusFilter, completion]);

  const remainingInFiltered = filtered.filter((r) => !r.attendance).length;
  const markedInFiltered = filtered.filter((r) => !!r.attendance).length;

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

  // Fast individual marking
  const markOne = async (item: RosterItem, status: AttendanceStatus, siteOverride?: string | null) => {
    setSaving(true);
    try {
      // Site handling: if item has attendance.site, use it unless overridden; if not marked, use suggestedSite or bulkSite or null
      let site: string | null = null;
      if (siteOverride !== undefined) site = siteOverride;
      else if (item.attendance?.site) {
        const s = item.attendance.site;
        site = typeof s === "string" ? s : (s as { _id: string })._id;
      } else if (item.suggestedSite) {
        // For remaining, suggestedSite is shown but not auto-saved unless user is in site-filtered context
        // If user is viewing a specific site, use that site
        if (siteFilter !== "all" && siteFilter !== "none") site = siteFilter;
        else site = null; // No Site unless explicitly chosen
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
      await fetchRoster();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Bulk helpers
  const getBulkRecords = (items: RosterItem[], status: AttendanceStatus, siteForBulk: string | null): Array<{ labour: string; status: AttendanceStatus; site: string | null }> => {
    return items.map((r) => {
      const site: string | null = siteForBulk;
      return { labour: r.labour._id, status, site };
    });
  };

  const handleMarkRemaining = async (status: AttendanceStatus) => {
    const remaining = filtered.filter((r) => !r.attendance);
    if (remaining.length === 0) return;
    // Site for bulk: if siteFilter is specific site, use it; else ask
    let siteForBulk: string | null = null;
    if (siteFilter !== "all" && siteFilter !== "none") siteForBulk = siteFilter;
    else if (siteFilter === "none") siteForBulk = null;
    else {
      // All Sites + Remaining: need to ask site
      // For now, default to No Site, but show bulkSite selector
      siteForBulk = bulkSite === "__none" ? null : bulkSite;
    }

    // If All Sites and no bulkSite chosen, prompt?
    // We'll just use No Site for now if not filtered
    setSaving(true);
    try {
      const records = getBulkRecords(remaining, status, siteForBulk);
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, records, overwrite: false }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Bulk failed");
      await fetchRoster();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAllBelow = async (status: AttendanceStatus) => {
    // Per spec, mark all below = currently displayed filtered rows, but only remaining unless overwrite confirmed
    const hasMarked = filtered.some((r) => !!r.attendance);
    if (hasMarked) {
      const overwriteCount = filtered.filter((r) => !!r.attendance).length;
      setConfirmBulk({ status, mode: "allBelow", count: filtered.length, overwriteCount });
      return;
    }
    // Only remaining
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

      const records = getBulkRecords(filtered, status, siteForBulk);
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, records, overwrite: true }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Bulk failed");
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
      const records = getBulkRecords(items, status, siteForBulk);
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, records, overwrite: true }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Bulk failed");
      setSelected(new Set());
      await fetchRoster();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: RosterItem) => {
    if (!item.attendance) return;
    try {
      const res = await fetch(`/api/attendance/${item.attendance._id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Delete failed");
      await fetchRoster();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Date + Counters */}
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
            <div>
              <dt className="text-text-muted">Total Labour</dt>
              <dd className="font-semibold tnum">{counters.total}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Marked</dt>
              <dd className="font-semibold tnum">{counters.marked}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Remaining</dt>
              <dd className="font-semibold tnum">{counters.remaining}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Present</dt>
              <dd className="font-semibold tnum text-success">{counters.present}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Half Day</dt>
              <dd className="font-semibold tnum text-amber-600">{counters.halfDay}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Absent</dt>
              <dd className="font-semibold tnum text-danger">{counters.absent}</dd>
            </div>
          </div>
        )}
      </Card>

      {/* Filters */}
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
            {sites.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </Select>
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-muted tnum">
              Showing {filtered.length} of {counters?.total ?? 0}
            </span>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear
              </Button>
            )}
          </div>
        </div>
        {hasActiveFilters && (
          <p className="mt-2 text-xs text-text-muted">
            Filters: {[
              completion !== "all" && completion,
              statusFilter !== "all" && STATUS_LABEL[statusFilter as AttendanceStatus],
              siteFilter !== "all" && (siteFilter === "none" ? "No Site" : sites.find((s) => s._id === siteFilter)?.name ?? siteFilter),
              search.trim() && `"${search.trim()}"`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </Card>

      {loading && <div className="text-sm text-text-muted">Loading roster...</div>}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error} <button type="button" className="underline" onClick={fetchRoster}>Retry</button>
        </p>
      )}

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
                  <TH>
                    <input type="checkbox" checked={allVisibleSelected} onChange={selectAllVisible} aria-label="Select all visible" />
                  </TH>
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
                  const suggested = !att ? item.suggestedSite?.name : null;
                  return (
                    <TR key={item.labour._id} className={cn(isSelected && "bg-primary/5")}>
                      <TD>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(item.labour._id)} aria-label={`Select ${item.labour.name}`} />
                      </TD>
                      <TD>
                        <div className="font-medium">{item.labour.name}</div>
                        <div className="text-xs text-text-muted tnum">
                          {item.labour.skill} · {item.labour.phone}
                        </div>
                      </TD>
                      <TD>
                        {att ? (
                          siteName ?? <span className="text-text-muted">—</span>
                        ) : suggested ? (
                          <span className="text-text-muted" title="Suggested from current assignment">
                            {suggested} <span className="text-xs">(suggested)</span>
                          </span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </TD>
                      <TD>
                        {att ? (
                          <Badge tone={STATUS_TONE[att.status]}>{STATUS_LABEL[att.status]}</Badge>
                        ) : (
                          <Badge tone="neutral">Not Marked</Badge>
                        )}
                      </TD>
                      <TD>
                        {att ? (
                          <div className="flex flex-wrap gap-1">
                            <Button size="sm" variant={att.status === "present" ? "primary" : "outline"} onClick={() => markOne(item, "present")} disabled={saving}>
                              Present
                            </Button>
                            <Button size="sm" variant={att.status === "half-day" ? "primary" : "outline"} onClick={() => markOne(item, "half-day")} disabled={saving}>
                              Half
                            </Button>
                            <Button size="sm" variant={att.status === "absent" ? "primary" : "outline"} onClick={() => markOne(item, "absent")} disabled={saving}>
                              Absent
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditing(item)}>
                              Edit
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            <Button size="sm" variant="outline" onClick={() => markOne(item, "present")} disabled={saving}>
                              Present
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => markOne(item, "half-day")} disabled={saving}>
                              Half
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => markOne(item, "absent")} disabled={saving}>
                              Absent
                            </Button>
                          </div>
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </Card>
      )}

      {editing && (
        <EditAttendanceModal
          item={editing}
          date={date}
          sites={sites}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await fetchRoster();
          }}
          onDeleted={async () => {
            setEditing(null);
            await fetchRoster();
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmBulk}
        onClose={() => setConfirmBulk(null)}
        onConfirm={confirmMarkAllBelow}
        title={`Change ${confirmBulk?.count} records?`}
        description={
          confirmBulk?.overwriteCount
            ? `You are about to change ${confirmBulk.overwriteCount} existing attendance records and create ${confirmBulk.count - confirmBulk.overwriteCount} new ones to "${confirmBulk.status}". Continue?`
            : `Mark ${confirmBulk?.count} labour as ${confirmBulk?.status}?`
        }
        pending={saving}
      />
    </div>
  );
}

function EditAttendanceModal({
  item,
  date,
  sites,
  onClose,
  onSaved,
  onDeleted,
}: {
  item: RosterItem;
  date: string;
  sites: { _id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [status, setStatus] = useState<AttendanceStatus>(item.attendance?.status ?? "present");
  const [site, setSite] = useState<string>(() => {
    const s = item.attendance?.site;
    if (!s) return "__none";
    return typeof s === "string" ? s : (s as { _id: string })._id;
  });
  const [notes, setNotes] = useState(item.attendance?.notes ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSave = async () => {
    setPending(true);
    setError(null);
    try {
      if (!item.attendance) {
        // Create for the roster's selected date
        const res = await fetch("/api/attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            records: [{ labour: item.labour._id, status, site: site === "__none" ? null : site, notes: notes.trim() || null }],
            overwrite: true,
          }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? "Save failed");
      } else {
        const res = await fetch(`/api/attendance/${item.attendance._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, site: site === "__none" ? null : site, notes: notes.trim() || null }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? "Save failed");
      }
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  };

  const handleDelete = async () => {
    if (!item.attendance) return;
    try {
      const res = await fetch(`/api/attendance/${item.attendance._id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Delete failed");
      onDeleted();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <Modal open onClose={onClose} title={`Edit ${item.labour.name} — ${formatDateShort(item.attendance?.date ?? date)}`}>
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium">Status</p>
            <div className="mt-2 flex gap-2">
              {(["present", "half-day", "absent"] as AttendanceStatus[]).map((s) => (
                <Button key={s} size="sm" variant={status === s ? "primary" : "outline"} onClick={() => setStatus(s)}>
                  {STATUS_LABEL[s]}
                </Button>
              ))}
            </div>
          </div>

          <Select label="Site" value={site} onChange={(e) => setSite(e.target.value)}>
            <option value="__none">No Site</option>
            {sites.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </Select>
          <p className="text-xs text-text-muted">Historical site is preserved — changing current assignment does not affect past attendance.</p>

          <Textarea label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Left after lunch..." />

          {error && <p role="alert" className="text-sm text-danger">{error}</p>}

          <div className="flex justify-between">
            {item.attendance ? (
              <Button variant="outline" onClick={() => setShowDeleteConfirm(true)} disabled={pending}>
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={pending}>
                {pending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete attendance?"
        description="This will remove the record and the labour will become Not Marked for this date."
        pending={pending}
      />
    </>
  );
}
