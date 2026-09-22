"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { formatDateShort, formatINR, toDateInputValue } from "@/lib/utils";
import type { OvertimeDTO } from "@/types/attendance";
import type { ProjectDTO } from "@/types/project";
import type { SiteDTO } from "@/types/site";
import type { LabourDTO } from "@/types/labour";

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

export function OvertimeList() {
  const [from, setFrom] = useState(() =>
    toDateInputValue(new Date(Date.now() - 29 * 86400000)),
  );
  const [to, setTo] = useState(() => toDateInputValue());
  const [projectId, setProjectId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [labourId, setLabourId] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [projects, setProjects] = useState<ProjectDTO[]>([]);
  const [sites, setSites] = useState<SiteDTO[]>([]);
  const [labour, setLabour] = useState<LabourDTO[]>([]);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<OvertimeDTO | null>(null);
  const [deleting, setDeleting] = useState<OvertimeDTO | null>(null);
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
    fetch(`/api/overtime?${params}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load overtime.");
        if (!json || !Array.isArray(json.data)) throw new Error("Invalid overtime response.");
        setData(json);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [from, to, projectId, siteId, labourId, page, reloadKey]);

  function refresh() {
    setLoading(true);
    setReloadKey((k) => k + 1);
  }

  function resetPage() {
    setPage(1);
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeletePending(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/overtime/${deleting._id}`, { method: "DELETE" });
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
      <PageHeader
        title="Overtime"
        description="Extra work beyond attendance OT hours. Enter here only — salary counts both."
        action={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            Add Overtime
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Hours" value={data ? String(data.totalHours) : "—"} hint="In selected filters" />
        <StatCard label="Total Amount" value={data ? formatINR(data.totalAmount) : "—"} hint="Hours × rate" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
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
      </div>

      {loading && <TableSkeleton rows={6} />}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error} <button type="button" className="underline" onClick={refresh}>Retry</button>
        </p>
      )}

      {!loading && !error && data && data.data.length === 0 && (
        <EmptyState
          title="No overtime records"
          description="Record extra hours with a custom rate — or leave blank to use the worker's hourly rate."
          action={
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              Add Overtime
            </Button>
          }
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
                <TH numeric>Hours</TH>
                <TH numeric>Rate</TH>
                <TH numeric>Amount</TH>
                <TH>Actions</TH>
              </TR>
            </THead>
            <tbody>
              {data.data.map((o) => (
                <TR key={o._id}>
                  <TD className="tnum">{formatDateShort(o.date)}</TD>
                  <TD className="font-medium">{refName(o.labour)}</TD>
                  <TD>{refName(o.site)}</TD>
                  <TD numeric>{o.hours}</TD>
                  <TD numeric>{formatINR(o.rate)}</TD>
                  <TD numeric>{formatINR(o.amount)}</TD>
                  <TD>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setEditing(o); setFormOpen(true); }}
                        className="text-sm text-text-muted hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDeleting(o); setDeleteError(null); }}
                        className="text-sm text-danger hover:underline"
                      >
                        Delete
                      </button>
                    </div>
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

      {formOpen && (
        <OvertimeFormModal
          key={editing?._id ?? "new"}
          initial={editing}
          labourOptions={labour}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
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

function OvertimeFormModal({
  initial,
  labourOptions,
  onClose,
  onSaved,
}: {
  initial: OvertimeDTO | null;
  labourOptions: LabourDTO[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [labourId, setLabourId] = useState(
    initial ? (typeof initial.labour === "string" ? initial.labour : initial.labour._id) : "",
  );
  const [siteId, setSiteId] = useState(
    initial ? (typeof initial.site === "string" ? initial.site : initial.site._id) : "",
  );
  const [date, setDate] = useState(
    initial ? new Date(initial.date).toISOString().slice(0, 10) : toDateInputValue(),
  );
  const [hours, setHours] = useState(initial ? String(initial.hours) : "");
  const [rate, setRate] = useState(initial ? String(initial.rate) : "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [sites, setSites] = useState<SiteDTO[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedLabour = labourOptions.find((l) => l._id === labourId);

  useEffect(() => {
    fetch("/api/sites?limit=100")
      .then(async (r) => r.json())
      .then((j) => {
        if (Array.isArray(j.data)) setSites(j.data);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!labourId || !siteId || !date || hours === "") {
      setError("Worker, site, date and hours are required.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const payload = {
        hours: Number(hours),
        rate: rate === "" ? null : Number(rate),
        notes: notes.trim() === "" ? null : notes.trim(),
        ...(initial ? {} : { labour: labourId, site: siteId, date }),
      };
      const url = initial ? `/api/overtime/${initial._id}` : "/api/overtime";
      const res = await fetch(url, {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed.");
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={initial ? "Edit Overtime" : "Add Overtime"}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {!initial && (
          <>
            <Select label="Worker" required value={labourId} onChange={(e) => setLabourId(e.target.value)}>
              <option value="">Select worker…</option>
              {labourOptions.map((l) => (
                <option key={l._id} value={l._id}>{l.name} · {l.skill}</option>
              ))}
            </Select>
            <Select label="Site" required value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">Select site…</option>
              {sites.map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </Select>
            <Input label="Date" required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </>
        )}
        <Input
          label="Hours"
          required
          type="number"
          min={0.1}
          max={24}
          step={0.5}
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          placeholder="2"
        />
        <Input
          label={`Rate (₹/hr)${selectedLabour && !initial ? ` — default ${formatINR(selectedLabour.hourlyRate)}` : ""}`}
          type="number"
          min={0}
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          placeholder="Leave blank for worker's hourly rate"
        />
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason…" />
        {error && (
          <p role="alert" className="text-sm text-danger">{error}</p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : initial ? "Save Changes" : "Add Overtime"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
