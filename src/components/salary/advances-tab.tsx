"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { formatDateShort, formatINR, toDateInputValue } from "@/lib/utils";
import type { AdvanceDTO } from "@/types/salary";
import { advanceLabourName, advanceSiteName } from "@/types/salary";
import type { LabourDTO } from "@/types/labour";
import type { SiteDTO } from "@/types/site";

interface ListResponse {
  data: AdvanceDTO[];
  page: number;
  limit: number;
  total: number;
  totalAmount: number;
}

export function AdvancesTab() {
  const [labourId, setLabourId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [labour, setLabour] = useState<LabourDTO[]>([]);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdvanceDTO | null>(null);
  const [deleting, setDeleting] = useState<AdvanceDTO | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/labour?limit=200&sort=name")
      .then(async (r) => r.json())
      .then((j) => {
        if (Array.isArray(j.data)) setLabour(j.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (labourId) params.set("labour", labourId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`/api/advances?${params}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load advances.");
        setData(json);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [labourId, from, to, page, reloadKey]);

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
      const res = await fetch(`/api/advances/${deleting._id}`, { method: "DELETE" });
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-muted">
          Advances deduct from the salary period containing their date — affected
          periods recalculate automatically.
        </p>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          Add Advance
        </Button>
      </div>

      <StatCard
        label="Total Advances"
        value={data ? formatINR(data.totalAmount) : "—"}
        hint="In selected filters"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select aria-label="Filter by worker" value={labourId} onChange={(e) => { setLabourId(e.target.value); resetPage(); }}>
          <option value="">All workers</option>
          {labour.map((l) => (
            <option key={l._id} value={l._id}>{l.name}</option>
          ))}
        </Select>
        <Input label="From" type="date" value={from} onChange={(e) => { setFrom(e.target.value); resetPage(); }} />
        <Input label="To" type="date" value={to} onChange={(e) => { setTo(e.target.value); resetPage(); }} />
      </div>

      {loading && <TableSkeleton rows={6} />}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error} <button type="button" className="underline" onClick={refresh}>Retry</button>
        </p>
      )}

      {!loading && !error && data && data.data.length === 0 && (
        <EmptyState
          title="No advances yet"
          description="Record money given in advance — it deducts from that period's salary."
          action={
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              Add Advance
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
                <TH>Reason</TH>
                <TH numeric>Amount</TH>
                <TH>Actions</TH>
              </TR>
            </THead>
            <tbody>
              {data.data.map((a) => (
                <TR key={a._id}>
                  <TD className="tnum">{formatDateShort(a.date)}</TD>
                  <TD className="font-medium">{advanceLabourName(a)}</TD>
                  <TD>{advanceSiteName(a) ?? "—"}</TD>
                  <TD>{a.reason ?? "—"}</TD>
                  <TD numeric>{formatINR(a.amount)}</TD>
                  <TD>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setEditing(a); setFormOpen(true); }}
                        className="text-sm text-text-muted hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDeleting(a); setDeleteError(null); }}
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
            <p className="tnum">{data.total} advance(s) · Page {data.page} of {totalPages}</p>
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
        <AdvanceFormModal
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
        title="Delete this advance?"
        description={deleteError ?? "Salary periods containing this date recalculate automatically."}
        pending={deletePending}
      />
    </div>
  );
}

function AdvanceFormModal({
  initial,
  labourOptions,
  onClose,
  onSaved,
}: {
  initial: AdvanceDTO | null;
  labourOptions: LabourDTO[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [labourId, setLabourId] = useState(
    initial ? (typeof initial.labour === "string" ? initial.labour : initial.labour._id) : "",
  );
  const [siteId, setSiteId] = useState(
    initial?.site ? (typeof initial.site === "string" ? initial.site : initial.site._id) : "",
  );
  const [date, setDate] = useState(
    initial ? new Date(initial.date).toISOString().slice(0, 10) : toDateInputValue(),
  );
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [reason, setReason] = useState(initial?.reason ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [sites, setSites] = useState<SiteDTO[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (amount === "" || Number(amount) < 1) {
      setError("Amount must be at least ₹1.");
      return;
    }
    if (!initial && (!labourId || !date)) {
      setError("Worker and date are required.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const payload = {
        amount: Number(amount),
        date: date === "" ? undefined : date,
        site: siteId === "" ? null : siteId,
        reason: reason.trim() === "" ? null : reason.trim(),
        notes: notes.trim() === "" ? null : notes.trim(),
        ...(initial ? {} : { labour: labourId }),
      };
      const url = initial ? `/api/advances/${initial._id}` : "/api/advances";
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
    <Modal open onClose={onClose} title={initial ? "Edit Advance" : "Add Advance"}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {!initial && (
          <Select label="Worker" required value={labourId} onChange={(e) => setLabourId(e.target.value)}>
            <option value="">Select worker…</option>
            {labourOptions.map((l) => (
              <option key={l._id} value={l._id}>{l.name} · {l.skill}</option>
            ))}
          </Select>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Input label="Date" required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Amount (₹)" required type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5000" />
        </div>
        <Select label="Site (optional)" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          <option value="">No site</option>
          {sites.map((s) => (
            <option key={s._id} value={s._id}>{s.name}</option>
          ))}
        </Select>
        <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Family emergency…" />
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes…" />
        {error && (
          <p role="alert" className="text-sm text-danger">{error}</p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : initial ? "Save Changes" : "Add Advance"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
