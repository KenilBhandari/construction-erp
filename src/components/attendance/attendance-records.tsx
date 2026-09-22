"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/modal";
import { formatDateShort, toDateInputValue } from "@/lib/utils";
import type { AttendanceDTO, AttendanceStatus } from "@/types/attendance";
import type { ProjectDTO } from "@/types/project";
import type { SiteDTO } from "@/types/site";
import type { LabourDTO } from "@/types/labour";

interface ListResponse {
  data: AttendanceDTO[];
  page: number;
  limit: number;
  total: number;
}

function nameOf(ref: string | { name: string } | null | undefined): string {
  if (!ref) return "—";
  return typeof ref === "string" ? ref : (ref.name ?? "—");
}

const STATUS_TONE: Record<AttendanceStatus, "success" | "danger" | "warning"> = {
  present: "success",
  absent: "danger",
  "half-day": "warning",
};

/** Date/site/labour-wise record history with inline corrections. */
export function AttendanceRecords({ initialLabourId = "" }: { initialLabourId?: string }) {
  const [from, setFrom] = useState(() =>
    toDateInputValue(new Date(Date.now() - 6 * 86400000)),
  );
  const [to, setTo] = useState(() => toDateInputValue());
  const [projectId, setProjectId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [labourId, setLabourId] = useState(initialLabourId);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [projects, setProjects] = useState<ProjectDTO[]>([]);
  const [sites, setSites] = useState<SiteDTO[]>([]);
  const [labour, setLabour] = useState<LabourDTO[]>([]);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AttendanceDTO | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/projects?limit=100")
      .then(async (r) => r.json())
      .then((j) => {
        if (Array.isArray(j.data)) setProjects(j.data);
      })
      .catch(() => {});
    fetch("/api/labour?limit=100&sort=name")
      .then(async (r) => r.json())
      .then((j) => {
        if (Array.isArray(j.data)) setLabour(j.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/sites?project=${projectId}&limit=100`)
      .then(async (r) => r.json())
      .then((j) => {
        if (Array.isArray(j.data)) setSites(j.data);
      })
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (projectId) params.set("project", projectId);
    if (siteId) params.set("site", siteId);
    if (labourId) params.set("labour", labourId);
    if (status) params.set("status", status);
    fetch(`/api/attendance?${params}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load records.");
        if (!json || !Array.isArray(json.data)) throw new Error("Invalid attendance response.");
        setData(json);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [from, to, projectId, siteId, labourId, status, page, reloadKey]);

  function refresh() {
    setLoading(true);
    setReloadKey((k) => k + 1);
  }

  function resetPage() {
    setPage(1);
  }

  async function changeStatus(id: string, next: AttendanceStatus) {
    try {
      const res = await fetch(`/api/attendance/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Update failed.");
      setData((d) =>
        d ? { ...d, data: d.data.map((r) => (r._id === id ? { ...r, status: next } : r)) } : d,
      );
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeletePending(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/attendance/${deleting._id}`, { method: "DELETE" });
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
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Input label="From" type="date" value={from} onChange={(e) => { setFrom(e.target.value); resetPage(); }} />
        <Input label="To" type="date" value={to} onChange={(e) => { setTo(e.target.value); resetPage(); }} />
        <Select label="Project" value={projectId} onChange={(e) => { setProjectId(e.target.value); setSiteId(""); setSites([]); resetPage(); }}>
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p._id} value={p._id}>{p.name}</option>
          ))}
        </Select>
        <Select label="Site" value={siteId} onChange={(e) => { setSiteId(e.target.value); resetPage(); }}>
          <option value="">{projectId ? "All sites" : "Pick project first"}</option>
          {sites.map((s) => (
            <option key={s._id} value={s._id}>{s.name}</option>
          ))}
        </Select>
        <Select label="Worker" value={labourId} onChange={(e) => { setLabourId(e.target.value); resetPage(); }}>
          <option value="">All workers</option>
          {labour.map((l) => (
            <option key={l._id} value={l._id}>{l.name}</option>
          ))}
        </Select>
        <Select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }}>
          <option value="">All statuses</option>
          <option value="present">Present</option>
          <option value="half-day">Half Day</option>
          <option value="absent">Absent</option>
        </Select>
      </div>

      {loading && <TableSkeleton rows={6} />}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error} <button type="button" className="underline" onClick={refresh}>Retry</button>
        </p>
      )}

      {!loading && !error && data && data.data.length === 0 && (
        <EmptyState
          title="No records in this range"
          description="Mark attendance first — records appear here for review and corrections."
        />
      )}

      {!loading && !error && data && data.data.length > 0 && (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Worker</TH>
                <TH>Site</TH>
                <TH>Status</TH>
                <TH numeric>OT hrs</TH>
                <TH>Actions</TH>
              </TR>
            </THead>
            <tbody>
              {data.data.map((r) => (
                <TR key={r._id}>
                  <TD className="tnum">{formatDateShort(r.date)}</TD>
                  <TD className="font-medium">{nameOf(r.labour)}</TD>
                  <TD>{nameOf(r.site)}</TD>
                  <TD>
                    <div className="flex items-center gap-2">
                      <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                      <select
                        aria-label={`Change status for ${nameOf(r.labour)}`}
                        value={r.status}
                        onChange={(e) => changeStatus(r._id, e.target.value as AttendanceStatus)}
                        className="rounded-md border border-border bg-surface px-1.5 py-1 text-xs text-text focus:border-primary focus:outline-none"
                      >
                        <option value="present">Present</option>
                        <option value="half-day">Half Day</option>
                        <option value="absent">Absent</option>
                      </select>
                    </div>
                  </TD>
                  <TD numeric>{r.overtimeHours}</TD>
                  <TD>
                    <button
                      type="button"
                      onClick={() => { setDeleting(r); setDeleteError(null); }}
                      className="text-sm text-danger hover:underline"
                    >
                      Delete
                    </button>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>

          <div className="flex items-center justify-between text-sm text-text-muted">
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

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete this record?"
        description={deleteError ?? "Salary for the period will no longer count this day."}
        pending={deletePending}
      />
    </div>
  );
}
