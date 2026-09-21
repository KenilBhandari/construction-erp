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
import type { ClientPaymentDTO } from "@/types/finance";
import { PAYMENT_METHODS } from "@/types/finance";
import type { ProjectDTO } from "@/types/project";

interface ListResponse {
  data: ClientPaymentDTO[];
  page: number;
  limit: number;
  total: number;
  totalReceived: number;
}

function projectName(p: ClientPaymentDTO): string {
  return typeof p.project === "string" ? p.project : p.project.name;
}

function clientName(p: ClientPaymentDTO): string {
  return typeof p.project === "string" ? "—" : (p.project.clientName ?? "—");
}

export function PaymentsList() {
  const [projectId, setProjectId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [projects, setProjects] = useState<ProjectDTO[]>([]);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClientPaymentDTO | null>(null);
  const [deleting, setDeleting] = useState<ClientPaymentDTO | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/projects?limit=100")
      .then(async (r) => r.json())
      .then((j) => {
        if (Array.isArray(j.data)) setProjects(j.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (projectId) params.set("project", projectId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`/api/payments?${params}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load payments.");
        setData(json);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [projectId, from, to, page, reloadKey]);

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
      const res = await fetch(`/api/payments/${deleting._id}`, { method: "DELETE" });
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
        title="Client Payments"
        description="Money received from clients, per project. Pending = contract − received."
        action={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            Record Payment
          </Button>
        }
      />

      <StatCard
        label="Total Received"
        value={data ? formatINR(data.totalReceived) : "—"}
        hint="In selected filters"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select aria-label="Filter by project" value={projectId} onChange={(e) => { setProjectId(e.target.value); resetPage(); }}>
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p._id} value={p._id}>{p.name}</option>
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
          title="No payments yet"
          description="Record the first client receipt against its project."
          action={
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              Record Payment
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
                <TH>Project / Client</TH>
                <TH>Method</TH>
                <TH numeric>Amount</TH>
                <TH>Actions</TH>
              </TR>
            </THead>
            <tbody>
              {data.data.map((p) => (
                <TR key={p._id}>
                  <TD className="tnum">{formatDateShort(p.date)}</TD>
                  <TD>
                    <span className="font-medium">{projectName(p)}</span>
                    <p className="text-xs text-text-muted">{clientName(p)}</p>
                  </TD>
                  <TD>
                    {p.paymentMethod}
                    {p.reference && <p className="text-xs text-text-muted">{p.reference}</p>}
                  </TD>
                  <TD numeric>{formatINR(p.amount)}</TD>
                  <TD>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setEditing(p); setFormOpen(true); }}
                        className="text-sm text-text-muted hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDeleting(p); setDeleteError(null); }}
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
            <p className="tnum">{data.total} payment(s) · Page {data.page} of {totalPages}</p>
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
        <PaymentFormModal
          key={editing?._id ?? "new"}
          initial={editing}
          projectOptions={projects}
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
        title="Delete this payment?"
        description={deleteError ?? "Pending amounts update automatically."}
        pending={deletePending}
      />
    </div>
  );
}

function PaymentFormModal({
  initial,
  projectOptions,
  onClose,
  onSaved,
}: {
  initial: ClientPaymentDTO | null;
  projectOptions: ProjectDTO[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [projectId, setProjectId] = useState(
    initial ? (typeof initial.project === "string" ? initial.project : initial.project._id) : "",
  );
  const [date, setDate] = useState(
    initial ? new Date(initial.date).toISOString().slice(0, 10) : toDateInputValue(),
  );
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [paymentMethod, setPaymentMethod] = useState(initial?.paymentMethod ?? "UPI");
  const [reference, setReference] = useState(initial?.reference ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProject = projectOptions.find((p) => p._id === projectId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!initial && !projectId) {
      setError("Select a project.");
      return;
    }
    if (amount === "" || Number(amount) < 1) {
      setError("Amount must be at least ₹1.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const payload = {
        ...(initial ? {} : { project: projectId }),
        date: date === "" ? undefined : date,
        amount: Number(amount),
        paymentMethod,
        reference: reference.trim() === "" ? null : reference.trim(),
        notes: notes.trim() === "" ? null : notes.trim(),
      };
      const url = initial ? `/api/payments/${initial._id}` : "/api/payments";
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
    <Modal open onClose={onClose} title={initial ? "Edit Payment" : "Record Payment"}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {!initial ? (
          <Select label="Project" required value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Select project…</option>
            {projectOptions.map((p) => (
              <option key={p._id} value={p._id}>{p.name} · {p.clientName}</option>
            ))}
          </Select>
        ) : (
          <p className="text-sm text-text-muted">
            {projectName(initial)} · payments stay on their project.
          </p>
        )}
        {selectedProject && (
          <p className="text-sm text-text-muted tnum">
            Contract {formatINR(selectedProject.contractValue)} · client {selectedProject.clientName}
          </p>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Input label="Date" required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Amount (₹)" required type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50000" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Payment Method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </Select>
          <Input label="Reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / cheque no." />
        </div>
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        {error && (
          <p role="alert" className="text-sm text-danger">{error}</p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : initial ? "Save Changes" : "Record Payment"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
