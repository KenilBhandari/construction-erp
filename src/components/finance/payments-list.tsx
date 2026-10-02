"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/ui/date-field";
import { ComboSelect } from "@/components/ui/combo-select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { DateSortToggle, dateSortParam } from "@/components/ui/date-sort-toggle";
import type { DateSortDir } from "@/components/ui/date-sort-toggle";
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
  const [method, setMethod] = useState("");
  const [page, setPage] = useState(1);
  const [sortDir, setSortDir] = useState<DateSortDir>("desc");
  const [reloadKey, setReloadKey] = useState(0);
  const [projects, setProjects] = useState<ProjectDTO[]>([]);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClientPaymentDTO | null>(null);
  const [viewing, setViewing] = useState<ClientPaymentDTO | null>(null);
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
    if (method) params.set("method", method);
    params.set("sort", dateSortParam(sortDir));
    fetch(`/api/payments?${params}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load payments.");
        setData(json);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [projectId, method, page, sortDir, reloadKey]);

  function toggleSortDir() {
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    resetPage();
  }

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

  const hasActiveFilters = Boolean(projectId || method);

  const projectFilterOptions = [
    { value: "", label: "All projects" },
    ...projects.map((p) => ({ value: p._id, label: p.name })),
  ];
  const methodFilterOptions = [
    { value: "", label: "All methods" },
    ...PAYMENT_METHODS.map((m) => ({ value: m, label: m })),
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
      <PageHeader
        title="Client Payments"
        action={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            Record Payment
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Received"
          value={data && !error ? formatINR(data.totalReceived) : "—"}
        />
      </div>

      {/* Phone: project + method side-by-side. */}
      <div className="flex flex-row gap-2 sm:hidden">
        <div className="min-w-0 flex-1">
          <ComboSelect
            ariaLabel="Filter by project"
            value={projectId}
            options={projectFilterOptions}
            onChange={(v) => { setProjectId(v); resetPage(); }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <ComboSelect
            ariaLabel="Filter by method"
            value={method}
            options={methodFilterOptions}
            onChange={(v) => { setMethod(v); resetPage(); }}
          />
        </div>
      </div>

      {/* Desktop: single row, no visible labels — matches Expenses. */}
      <div className="hidden sm:flex sm:flex-row sm:items-center sm:gap-3">
        <div className="min-w-0 flex-1">
          <ComboSelect
            ariaLabel="Filter by project"
            value={projectId}
            options={projectFilterOptions}
            onChange={(v) => { setProjectId(v); resetPage(); }}
          />
        </div>
        <div className="w-44 shrink-0 sm:w-48">
          <ComboSelect
            ariaLabel="Filter by method"
            value={method}
            options={methodFilterOptions}
            onChange={(v) => { setMethod(v); resetPage(); }}
          />
        </div>
      </div>

      {loading && <TableSkeleton rows={6} />}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error} <button type="button" className="underline" onClick={refresh}>Retry</button>
        </p>
      )}

      {!loading && !error && data && data.data.length === 0 && (
        <EmptyState
          title={hasActiveFilters ? "No entries found" : "No payments yet"}
          description={
            hasActiveFilters
              ? "Try different filters."
              : "Record payments received from clients."
          }
          action={
            hasActiveFilters ? undefined : (
              <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
                Record Payment
              </Button>
            )
          }
        />
      )}

      {!loading && !error && data && data.data.length > 0 && (
        <>
          {/* Phone sort bar — right-aligned pill below filters, cards untouched. */}
          <div className="-my-1 flex justify-end sm:hidden">
            <DateSortToggle dir={sortDir} onToggle={toggleSortDir} variant="pill" />
          </div>
          {/* Phone cards — desktop table below stays untouched. */}
          <ul className="flex flex-col gap-2 sm:hidden">
            {data.data.map((p) => {
              const client = clientName(p);
              return (
                <li key={p._id}>
                  <Card className="cursor-pointer p-3 active:bg-background">
                    <div
                      className="flex flex-col gap-1.5"
                      onClick={() => setViewing(p)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 flex-1 truncate text-[15px] font-medium text-text">
                          {projectName(p)}
                        </p>
                        <Badge tone="neutral" className="shrink-0">{p.paymentMethod}</Badge>
                      </div>
                      <p className="min-w-0 truncate text-xs text-text-muted tnum">
                        {formatDateShort(p.date)}{client === "—" ? "" : ` · ${client}`}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-[15px] font-semibold tnum text-text">
                          {formatINR(p.amount)}
                        </p>
                        <div className="-mr-1.5 flex shrink-0 items-center" onClick={(ev) => ev.stopPropagation()}>
                          <button
                            type="button"
                            aria-label={`Edit payment for ${projectName(p)}`}
                            onClick={() => { setEditing(p); setFormOpen(true); }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-primary/10 hover:text-primary"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete payment for ${projectName(p)}`}
                            onClick={() => { setDeleting(p); setDeleteError(null); }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-danger/10 hover:text-danger"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>

          <div className="hidden sm:block">
            <Table>
              <THead>
                <TR>
                  <TH><DateSortToggle dir={sortDir} onToggle={toggleSortDir} /></TH>
                  <TH>Project / Client</TH>
                  <TH>Method</TH>
                  <TH numeric>Amount</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <tbody>
                {data.data.map((p) => {
                  const client = clientName(p);
                  return (
                  <TR key={p._id} className="cursor-pointer hover:bg-background/70" onClick={() => setViewing(p)}>
                    <TD className="tnum">{formatDateShort(p.date)}</TD>
                    <TD className="max-w-[220px] truncate font-medium text-primary" title={client === "—" ? projectName(p) : `${projectName(p)} · ${client}`}>
                      {projectName(p)}{client === "—" ? "" : ` · ${client}`}
                    </TD>
                    <TD>
                      <Badge tone="neutral">{p.paymentMethod}</Badge>
                    </TD>
                    <TD numeric>{formatINR(p.amount)}</TD>
                    <TD>
                      <div className="flex items-center justify-end gap-1" onClick={(ev) => ev.stopPropagation()}>
                        <button
                          type="button"
                          aria-label="Edit payment"
                          title="Edit"
                          onClick={() => { setEditing(p); setFormOpen(true); }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-primary/10 hover:text-primary"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Delete payment"
                          title="Delete"
                          onClick={() => { setDeleting(p); setDeleteError(null); }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TD>
                  </TR>
                  );
                })}
              </tbody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted sm:text-sm">
            <p className="tnum">{data.total} entries · Page {data.page} of {totalPages}</p>
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

      {viewing && (
        <PaymentDetailModal p={viewing} onClose={() => setViewing(null)} />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete this payment?"
        description={deleteError ?? `Deletes the ${deleting ? formatINR(deleting.amount) : ""} payment permanently.`}
        pending={deletePending}
      />
    </div>
  );
}

function PaymentDetailModal({ p, onClose }: { p: ClientPaymentDTO; onClose: () => void }) {
  const rows: { label: string; value: string }[] = [
    { label: "Date", value: formatDateShort(p.date) },
    { label: "Project", value: projectName(p) },
    { label: "Client", value: clientName(p) },
    { label: "Payment Method", value: p.paymentMethod },
  ];
  if (p.reference) rows.push({ label: "Reference", value: p.reference });

  return (
    <Modal open onClose={onClose} title={projectName(p)} size="lg">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge tone="neutral" className="self-start">{p.paymentMethod}</Badge>
          <p className="text-sm font-semibold tnum text-text">{formatINR(p.amount)}</p>
        </div>
        <dl className="divide-y divide-border rounded-md border border-border">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3 px-3 py-2">
              <dt className="shrink-0 text-[13px] text-text-muted">{r.label}</dt>
              <dd className="min-w-0 truncate text-right text-sm font-medium text-text tnum">{r.value}</dd>
            </div>
          ))}
        </dl>
        {p.notes && (
          <div className="flex flex-col gap-1">
            <p className="text-[13px] text-text-muted">Notes</p>
            <p className="text-sm leading-6 text-text">{p.notes}</p>
          </div>
        )}
        <div className="flex flex-row justify-end gap-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pb-0">
          <Button variant="outline" onClick={onClose} className="h-11 sm:h-auto">
            Close
          </Button>
        </div>
      </div>
    </Modal>
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

  // Locked option keeps the edit-mode project visible even if the
  // list fetch hasn't returned it yet.
  const initialProjectObj =
    initial && initial.project && typeof initial.project === "object" ? initial.project : null;

  const projectSelectOptions = [
    { value: "", label: "Select project…" },
    ...(initialProjectObj && !projectOptions.some((p) => p._id === initialProjectObj._id)
      ? [{ value: initialProjectObj._id, label: `${initialProjectObj.name} · ${initialProjectObj.clientName ?? ""}` }]
      : []),
    ...projectOptions.map((p) => ({ value: p._id, label: `${p.name} · ${p.clientName}` })),
  ];

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
          <div className="min-w-0">
            <ComboSelect
              label="Project"
              required
              value={projectId}
              options={projectSelectOptions}
              onChange={setProjectId}
              disabled={pending}
              triggerClassName="h-11 text-base sm:h-[38px] sm:text-sm"
            />
          </div>
        ) : (
          <Input label="Project" value={projectName(initial)} disabled />
        )}
        {selectedProject && (
          <p className="-mt-2 text-sm text-text-muted tnum">
            Contract {formatINR(selectedProject.contractValue)} · client {selectedProject.clientName}
          </p>
        )}
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-4">
          <div className="min-w-0">
            <DateField label="Date" required value={date} onChange={setDate} disabled={pending} />
          </div>
          <div className="min-w-0">
            <Input label="Amount (₹)" required type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50000" disabled={pending} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-4">
          <div className="min-w-0">
            <ComboSelect
              label="Payment Method"
              value={paymentMethod}
              options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}
              onChange={setPaymentMethod}
              disabled={pending}
              triggerClassName="h-11 text-base sm:h-[38px] sm:text-sm"
            />
          </div>
          <div className="min-w-0">
            <Input label="Reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / cheque no." disabled={pending} />
          </div>
        </div>
        <Textarea label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={pending} />
        {error && (
          <p role="alert" className="text-sm text-danger">{error}</p>
        )}
        <div className="flex flex-row justify-end gap-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pb-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending} className="h-11 sm:h-auto">
            Cancel
          </Button>
          <Button type="submit" disabled={pending} className="h-11 sm:h-auto">
            {pending ? "Saving…" : initial ? "Save Changes" : "Record Payment"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
