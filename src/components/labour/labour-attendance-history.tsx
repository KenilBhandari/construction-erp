"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { formatDateShort, toDateInputValue } from "@/lib/utils";
import type { AttendanceStatus } from "@/types/attendance";
import type { SiteDTO } from "@/types/site";

interface AttendanceRow {
  _id: string;
  labour: string | { _id: string; name: string };
  site: string | { _id: string; name: string } | null;
  project: string | { _id: string; name: string } | null;
  date: string;
  status: AttendanceStatus;
  notes: string | null;
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

function siteNameOf(site: AttendanceRow["site"]): string {
  if (!site) return "—";
  return typeof site === "string" ? site : site.name;
}

export function LabourAttendanceHistory({ labourId, labourName }: { labourId: string; labourName: string }) {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<AttendanceRow | null>(null);
  const [deleting, setDeleting] = useState<AttendanceRow | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance?labour=${labourId}&limit=10`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Failed to load");
      setRows(j.data ?? []);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labourId]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletePending(true);
    try {
      const res = await fetch(`/api/attendance/${deleting._id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Delete failed");
      setDeleting(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeletePending(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text">Attendance History</h2>
        <Button size="sm" onClick={() => setShowAdd(true)}>Add Attendance</Button>
      </div>
      <p className="mt-1 text-xs text-text-muted">Historical records — site is preserved per date, not overwritten by current assignment.</p>

      {loading && <p className="mt-3 text-sm text-text-muted">Loading...</p>}
      {error && <p className="mt-3 text-sm text-danger">{error} <button className="underline" onClick={load}>Retry</button></p>}

      {!loading && !error && rows.length === 0 && (
        <p className="mt-3 text-sm text-text-muted">No attendance records yet. Add one for any past date.</p>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Status</TH>
                <TH>Site</TH>
                <TH>Notes</TH>
                <TH>Action</TH>
              </TR>
            </THead>
            <tbody>
              {rows.map((r) => (
                <TR key={r._id}>
                  <TD className="tnum">{formatDateShort(r.date)}</TD>
                  <TD><Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge></TD>
                  <TD>{siteNameOf(r.site)}</TD>
                  <TD className="max-w-[200px] truncate">{r.notes ?? "—"}</TD>
                  <TD>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setEditing(r)} className="text-sm text-primary hover:underline">Edit</button>
                      <button type="button" onClick={() => setDeleting(r)} className="text-sm text-danger hover:underline">Delete</button>
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      {showAdd && (
        <AttendanceFormModal
          labourId={labourId}
          labourName={labourName}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }}
        />
      )}
      {editing && (
        <AttendanceFormModal
          labourId={labourId}
          labourName={labourName}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete attendance?"
        description="This will make the date Not Marked. Use Edit to change Present/Absent instead."
        pending={deletePending}
      />
    </Card>
  );
}

function AttendanceFormModal({
  labourId,
  labourName,
  initial,
  onClose,
  onSaved,
}: {
  labourId: string;
  labourName: string;
  initial?: AttendanceRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(() => (initial ? new Date(initial.date).toISOString().slice(0, 10) : toDateInputValue()));
  const [status, setStatus] = useState<AttendanceStatus>(initial?.status ?? "present");
  const [site, setSite] = useState<string>(() => {
    if (!initial?.site) return "__none";
    return typeof initial.site === "string" ? initial.site : initial.site._id;
  });
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [sites, setSites] = useState<SiteDTO[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sites?limit=100")
      .then(async (r) => r.json())
      .then((j) => { if (Array.isArray(j.data)) setSites(j.data); })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      if (initial) {
        const res = await fetch(`/api/attendance/${initial._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, site: site === "__none" ? null : site, notes: notes.trim() || null }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? "Save failed");
      } else {
        const res = await fetch("/api/attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, records: [{ labour: labourId, status, site: site === "__none" ? null : site, notes: notes.trim() || null }], overwrite: true }),
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

  return (
    <Modal open onClose={onClose} title={initial ? `Edit ${labourName} — ${formatDateShort(initial.date)}` : `Add Attendance — ${labourName}`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {!initial && <Input label="Date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />}
        {initial && <p className="text-sm text-text-muted">Date: {formatDateShort(initial.date)} (change via delete + add if needed)</p>}
        <div>
          <p className="text-sm font-medium">Status</p>
          <div className="mt-2 flex gap-2">
            {(["present", "half-day", "absent"] as AttendanceStatus[]).map((s) => (
              <Button key={s} type="button" size="sm" variant={status === s ? "primary" : "outline"} onClick={() => setStatus(s)}>
                {STATUS_LABEL[s]}
              </Button>
            ))}
          </div>
        </div>
        <Select label="Site" value={site} onChange={(e) => setSite(e.target.value)}>
          <option value="__none">No Site</option>
          {sites.map((s) => (
            <option key={s._id} value={s._id}>{s.name}</option>
          ))}
        </Select>
        <Textarea label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Supervisor corrected..." />
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" disabled={pending}>{pending ? "Saving..." : initial ? "Save" : "Add"}</Button>
        </div>
      </form>
    </Modal>
  );
}
