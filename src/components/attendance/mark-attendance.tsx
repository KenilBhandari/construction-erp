"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { toDateInputValue } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { AttendanceStatus } from "@/types/attendance";
import type { LabourDTO } from "@/types/labour";
import type { ProjectDTO } from "@/types/project";
import type { SiteDTO } from "@/types/site";

interface RowMark {
  labourId: string;
  name: string;
  skill: string;
  status: AttendanceStatus | null;
  overtimeHours: string;
}

const STATUS_BUTTONS: { value: AttendanceStatus; label: string; active: string }[] = [
  { value: "present", label: "Present", active: "bg-green-600 text-white border-transparent" },
  { value: "half-day", label: "Half", active: "bg-amber-500 text-white border-transparent" },
  { value: "absent", label: "Absent", active: "bg-danger text-white border-transparent" },
];

/**
 * Fast daily entry: Date → Project → Site → mark rows → save.
 * No per-row modals; check-in/out corrections live in Records.
 */
export function MarkAttendance() {
  const [date, setDate] = useState(toDateInputValue());
  const [projectId, setProjectId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [projects, setProjects] = useState<ProjectDTO[]>([]);
  const [sites, setSites] = useState<SiteDTO[]>([]);
  // null = roster not loaded yet (also the loading indicator).
  const [rows, setRows] = useState<RowMark[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/projects?limit=100")
      .then(async (res) => {
        const json = await res.json();
        if (res.ok && Array.isArray(json.data)) setProjects(json.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/sites?project=${projectId}&limit=100`)
      .then(async (res) => {
        const json = await res.json();
        if (res.ok && Array.isArray(json.data)) setSites(json.data);
      })
      .catch(() => {});
  }, [projectId]);

  // Load assigned labour + existing marks when site+date are set.
  useEffect(() => {
    if (!siteId || !date) return;
    Promise.all([
      fetch(`/api/labour?site=${siteId}&status=active&limit=100&sort=name`).then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Failed to load labour");
        return j;
      }),
      fetch(`/api/attendance?date=${date}&site=${siteId}&limit=100`).then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Failed to load attendance");
        return j;
      }),
    ])
      .then(([labourJson, attJson]) => {
        const labour: LabourDTO[] = Array.isArray(labourJson.data) ? labourJson.data : [];
        const existing: Record<string, { status: AttendanceStatus; overtimeHours: number }> = {};
        if (Array.isArray(attJson.data)) {
          for (const a of attJson.data) {
            const lid = typeof a.labour === "string" ? a.labour : (a.labour as { _id: string })._id;
            existing[lid] = { status: a.status, overtimeHours: a.overtimeHours ?? 0 };
          }
        }
        setRows(
          labour.map((l) => ({
            labourId: l._id,
            name: l.name,
            skill: l.skill,
            status: existing[l._id]?.status ?? "present",
            overtimeHours: String(existing[l._id]?.overtimeHours ?? ""),
          })),
        );
        setMessage(null);
      })
      .catch((err: Error) => {
        setRows([]);
        setMessage({ kind: "error", text: err.message || "Failed to load roster." });
      });
  }, [siteId, date]);

  function onProjectChange(value: string) {
    setProjectId(value);
    setSiteId("");
    setSites([]);
    setRows(null);
    setMessage(null);
  }

  function onSiteChange(value: string) {
    setSiteId(value);
    setRows(null);
    setMessage(null);
  }

  function onDateChange(value: string) {
    setDate(value);
    setRows(null);
    setMessage(null);
  }

  function setRowStatus(labourId: string, status: AttendanceStatus) {
    setRows((rs) => (rs ?? []).map((r) => (r.labourId === labourId ? { ...r, status } : r)));
  }

  function setRowOT(labourId: string, value: string) {
    setRows((rs) => (rs ?? []).map((r) => (r.labourId === labourId ? { ...r, overtimeHours: value } : r)));
  }

  function markAll(status: AttendanceStatus | null) {
    setRows((rs) => (rs ?? []).map((r) => ({ ...r, status })));
  }

  const marked = (rows ?? []).filter((r) => r.status !== null).length;

  async function handleSave() {
    if (!siteId || !date) return;
    const records = (rows ?? [])
      .filter((r) => r.status !== null)
      .map((r) => ({
        labour: r.labourId,
        status: r.status as AttendanceStatus,
        overtimeHours: r.overtimeHours === "" ? 0 : Number(r.overtimeHours),
        notes: null,
      }));
    if (records.some((r) => Number.isNaN(r.overtimeHours) || r.overtimeHours < 0)) {
      setMessage({ kind: "error", text: "Overtime hours must be 0 or more." });
      return;
    }
    if (records.length === 0) {
      setMessage({ kind: "error", text: "Mark at least one worker before saving." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, site: siteId, records }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed.");
      setMessage({ kind: "ok", text: `Attendance saved for ${json.saved} worker(s).` });
    } catch (err) {
      setMessage({ kind: "error", text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input label="Date" type="date" value={date} onChange={(e) => onDateChange(e.target.value)} />
        <Select label="Project" value={projectId} onChange={(e) => onProjectChange(e.target.value)}>
          <option value="">Select project…</option>
          {projects.map((p) => (
            <option key={p._id} value={p._id}>{p.name}</option>
          ))}
        </Select>
        <Select label="Site" value={siteId} onChange={(e) => onSiteChange(e.target.value)} disabled={!projectId}>
          <option value="">{projectId ? "Select site…" : "Select project first"}</option>
          {sites.map((s) => (
            <option key={s._id} value={s._id}>{s.name}</option>
          ))}
        </Select>
      </div>

      {!siteId && (
        <EmptyState
          title="Select date, project and site"
          description="The site roster appears here for one-tap marking."
        />
      )}

      {siteId && rows === null && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {siteId && rows !== null && rows.length === 0 && !message && (
        <EmptyState
          title="No active workers on this site"
          description="Assign labour to this site first — then return here to mark attendance."
        />
      )}
      {message?.kind === "error" && (
        <p role="alert" className="text-sm text-danger">
          {message.text} <button type="button" className="underline ml-2" onClick={() => { setRows(null); setMessage(null); }}>Retry</button>
        </p>
      )}

      {siteId && rows !== null && rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => markAll("present")}>Mark all present</Button>
            <Button size="sm" variant="outline" onClick={() => markAll(null)}>Clear</Button>
            <span className="ml-auto text-sm text-text-muted tnum">
              {marked} / {rows.length} marked · {date}
            </span>
          </div>

          <Card className="divide-y divide-border">
            {rows.map((r) => (
              <div key={r.labourId} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">{r.name}</p>
                  <p className="text-xs text-text-muted">{r.skill}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {STATUS_BUTTONS.map((b) => (
                    <button
                      key={b.value}
                      type="button"
                      onClick={() => setRowStatus(r.labourId, b.value)}
                      className={cn(
                        "rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-muted transition-colors hover:bg-background",
                        r.status === b.value && b.active,
                      )}
                    >
                      {b.label}
                    </button>
                  ))}
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={r.overtimeHours}
                    onChange={(e) => setRowOT(r.labourId, e.target.value)}
                    placeholder="OT hrs"
                    aria-label={`Overtime hours for ${r.name}`}
                    className="w-20 rounded-md border border-border bg-surface px-2 py-1 text-xs tnum text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            ))}
          </Card>

          {message && (
            <p role="status" className={cn("text-sm", message.kind === "ok" ? "text-success" : "text-danger")}>
              {message.text}
            </p>
          )}

          <div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : `Save attendance (${marked})`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
