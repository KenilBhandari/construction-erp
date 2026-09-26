"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { formatDateShort, formatINR, toDateInputValue } from "@/lib/utils";
import { Pencil, Trash2 } from "lucide-react";
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

export function OvertimeList({ externalRefreshKey }: { externalRefreshKey?: number } = {}) {
  const router = useRouter();
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
    if (externalRefreshKey !== undefined && externalRefreshKey > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReloadKey((k) => k + 1);
    }
  }, [externalRefreshKey]);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: "20" });
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
  }, [projectId, siteId, labourId, page, reloadKey]);

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

  function labourIdOf(ref: OvertimeDTO["labour"]): string | null {
    if (!ref) return null;
    return typeof ref === "string" ? ref : (ref as { _id: string })._id;
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Overtime"
        action={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            Add Overtime
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <tbody>
              {data.data.map((o) => (
                <TR key={o._id} className="cursor-pointer hover:bg-background/70" onClick={() => { const id = labourIdOf(o.labour); if (id) router.push(`/dashboard/labour/${id}`); }}>
                  <TD className="tnum">{formatDateShort(o.date)}</TD>
                  <TD className="font-medium">{refName(o.labour)}</TD>
                  <TD>{refName(o.site)}</TD>
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
  const rateNum = rate === "" ? (selectedLabour?.hourlyRate ?? 0) : Number(rate);
  const hoursNum = Number(hours);
  const previewAmount = !isNaN(hoursNum) && !isNaN(rateNum) && hoursNum > 0 ? Math.round(hoursNum * rateNum) : 0;

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
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        hours: Number(hours),
        rate: rate === "" ? null : Number(rate),
        notes: notes.trim() === "" ? null : notes.trim(),
        ...(initial ? { site: siteId } : { labour: labourId, site: siteId, date }),
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
        <Select label="Worker" required value={labourId} onChange={(e) => setLabourId(e.target.value)} disabled={!!initial}>
          <option value="">Select worker…</option>
          {labourOptions.map((l) => (
            <option key={l._id} value={l._id}>{l.name} · {l.skill}</option>
          ))}
        </Select>
        <Select label="Site" required value={siteId} onChange={(e) => setSiteId(e.target.value)} disabled={pending}>
          <option value="">Select site…</option>
          {sites.map((s) => (
            <option key={s._id} value={s._id}>{s.name}</option>
          ))}
        </Select>
        <Input label="Date" required type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={!!initial} />
        <Input
          label="Hours"
          required
          type="number"
          max={24}
          step="any"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          placeholder="2"
          disabled={pending}
        />
        <Input
          label={`Rate (₹/hr)${selectedLabour ? ` — default ${formatINR(selectedLabour.hourlyRate)}` : ""}`}
          type="number"
          min={0}
          step="any"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          placeholder="Leave blank for worker's hourly rate"
          disabled={pending}
        />
        {hoursNum > 0 && (
          <p className="rounded bg-background px-3 py-2 text-sm font-medium">Amount = {hoursNum} × {formatINR(rateNum)} = {formatINR(previewAmount)}</p>
        )}
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason…" disabled={pending} />
        {error && (
          <p role="alert" className="whitespace-pre-wrap text-sm text-danger">{error}</p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : initial ? "Save Changes" : "Add Overtime"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
