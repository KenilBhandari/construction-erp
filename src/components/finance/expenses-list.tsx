"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { formatDateShort, formatINR, toDateInputValue } from "@/lib/utils";
import type { ExpenseDTO } from "@/types/finance";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "@/types/finance";
import type { ProjectDTO } from "@/types/project";
import type { SiteDTO } from "@/types/site";

interface ListResponse {
  data: ExpenseDTO[];
  page: number;
  limit: number;
  total: number;
  totalAmount: number;
}

function projectName(e: ExpenseDTO): string {
  return typeof e.project === "string" ? e.project : (e.project?.name ?? "General");
}

function siteName(e: ExpenseDTO): string {
  return typeof e.site === "string" ? e.site : (e.site?.name ?? "—");
}

export function ExpensesList() {
  const [projectId, setProjectId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [category, setCategory] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [projects, setProjects] = useState<ProjectDTO[]>([]);
  const [sites, setSites] = useState<SiteDTO[]>([]);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseDTO | null>(null);
  const [viewing, setViewing] = useState<ExpenseDTO | null>(null);
  const [deleting, setDeleting] = useState<ExpenseDTO | null>(null);
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
    if (projectId) params.set("project", projectId);
    if (siteId) params.set("site", siteId);
    if (category) params.set("category", category);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`/api/expenses?${params}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load expenses.");
        setData(json);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [projectId, siteId, category, from, to, page, reloadKey]);

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
      const res = await fetch(`/api/expenses/${deleting._id}`, { method: "DELETE" });
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
        title="Expenses"
        action={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            Add Expense
          </Button>
        }
      />

      <div className="grid max-w-sm grid-cols-2 gap-2">
        <Card className="p-3">
          <p className="text-xs text-text-muted">Total</p>
          <p className="mt-0.5 text-lg font-semibold tnum">{data && !error ? formatINR(data.totalAmount) : "—"}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-text-muted">Entries</p>
          <p className="mt-0.5 text-lg font-semibold tnum">{data && !error ? data.total : "—"}</p>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label="Filter by project" className="w-44" value={projectId} onChange={(e) => { setProjectId(e.target.value); setSiteId(""); setSites([]); resetPage(); }}>
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p._id} value={p._id}>{p.name}</option>
          ))}
        </Select>
        <Select aria-label="Filter by site" className="w-40" value={siteId} onChange={(e) => { setSiteId(e.target.value); resetPage(); }}>
          <option value="">{projectId ? "All sites" : "Pick project first"}</option>
          {sites.map((s) => (
            <option key={s._id} value={s._id}>{s.name}</option>
          ))}
        </Select>
        <Select aria-label="Filter by category" className="w-40" value={category} onChange={(e) => { setCategory(e.target.value); resetPage(); }}>
          <option value="">All categories</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
        <Input aria-label="From date" type="date" className="w-36" value={from} onChange={(e) => { setFrom(e.target.value); resetPage(); }} />
        <Input aria-label="To date" type="date" className="w-36" value={to} onChange={(e) => { setTo(e.target.value); resetPage(); }} />
        {(projectId || siteId || category || from || to) && (
          <Button variant="outline" size="sm" onClick={() => { setProjectId(""); setSiteId(""); setSites([]); setCategory(""); setFrom(""); setTo(""); resetPage(); }}>
            Clear
          </Button>
        )}
      </div>

      {loading && <TableSkeleton rows={6} />}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error} <button type="button" className="underline" onClick={refresh}>Retry</button>
        </p>
      )}

      {!loading && !error && data && data.data.length === 0 && (
        <EmptyState
          title="No expenses yet"
          action={
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              Add Expense
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
                <TH>Description</TH>
                <TH>Project / Site</TH>
                <TH>Category</TH>
                <TH numeric>Amount</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <tbody>
              {data.data.map((e) => {
                const site = siteName(e);
                return (
                <TR key={e._id} className="cursor-pointer hover:bg-background/70" onClick={() => setViewing(e)}>
                  <TD className="tnum">{formatDateShort(e.date)}</TD>
                  <TD className="max-w-[220px] truncate font-medium text-primary" title={e.description}>{e.description}</TD>
                  <TD className="max-w-[200px] truncate" title={site === "—" ? projectName(e) : `${projectName(e)} · ${site}`}>
                    {projectName(e)}{site === "—" ? "" : ` · ${site}`}
                  </TD>
                  <TD>
                    <Badge tone="neutral">{e.category}</Badge>
                  </TD>
                  <TD numeric>{formatINR(e.amount)}</TD>
                  <TD>
                    <div className="flex items-center justify-end gap-1" onClick={(ev) => ev.stopPropagation()}>
                      <button
                        type="button"
                        aria-label="Edit expense"
                        title="Edit"
                        onClick={() => { setEditing(e); setFormOpen(true); }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-primary/10 hover:text-primary"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete expense"
                        title="Delete"
                        onClick={() => { setDeleting(e); setDeleteError(null); }}
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

          <div className="flex items-center justify-between text-sm text-text-muted">
            <p className="tnum">Page {data.page} of {totalPages}</p>
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
        <ExpenseFormModal
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
        <Modal open={!!viewing} onClose={() => setViewing(null)} title="Expense Details" size="lg">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-base font-semibold">{viewing.description}</p>
              <p className="text-sm font-semibold tnum">{formatINR(viewing.amount)}</p>
            </div>
            <p className="-mt-3 text-xs text-text-muted tnum">
              {formatDateShort(viewing.date)}
              {viewing.paymentMethod ? ` · ${viewing.paymentMethod}` : ""}
              {viewing.reference ? ` · ${viewing.reference}` : ""}
            </p>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-text-muted">Project / Site</dt>
                <dd className="mt-0.5 font-medium">
                  {projectName(viewing)}{siteName(viewing) === "—" ? "" : ` · ${siteName(viewing)}`}
                </dd>
              </div>
              <div><dt className="text-xs text-text-muted">Category</dt><dd className="mt-0.5">{viewing.category}</dd></div>
              <div><dt className="text-xs text-text-muted">Vendor</dt><dd className="mt-0.5">{viewing.vendor ?? "—"}</dd></div>
              <div><dt className="text-xs text-text-muted">Payment Method</dt><dd className="mt-0.5">{viewing.paymentMethod}</dd></div>
              {viewing.reference && <div><dt className="text-xs text-text-muted">Reference</dt><dd className="mt-0.5 tnum">{viewing.reference}</dd></div>}
              {viewing.notes && <div className="col-span-2"><dt className="text-xs text-text-muted">Notes</dt><dd className="mt-0.5 text-sm">{viewing.notes}</dd></div>}
            </dl>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete this expense?"
        description={deleteError ?? `Deletes ${deleting?.description ?? "this expense"} permanently.`}
        pending={deletePending}
      />
    </div>
  );
}

function ExpenseFormModal({
  initial,
  projectOptions,
  onClose,
  onSaved,
}: {
  initial: ExpenseDTO | null;
  projectOptions: ProjectDTO[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [projectId, setProjectId] = useState(
    initial?.project ? (typeof initial.project === "string" ? initial.project : initial.project._id) : "",
  );
  const [siteId, setSiteId] = useState(
    initial?.site ? (typeof initial.site === "string" ? initial.site : initial.site._id) : "",
  );
  const [date, setDate] = useState(
    initial ? new Date(initial.date).toISOString().slice(0, 10) : toDateInputValue(),
  );
  const [category, setCategory] = useState(initial?.category ?? "Miscellaneous");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [vendor, setVendor] = useState(initial?.vendor ?? "");
  const [paymentMethod, setPaymentMethod] = useState(initial?.paymentMethod ?? "Cash");
  const [reference, setReference] = useState(initial?.reference ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [sites, setSites] = useState<SiteDTO[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialSiteObj = initial && initial.site && typeof initial.site === "object" ? initial.site : null;
  const lockedSiteOption = initialSiteObj && !sites.some((s) => s._id === initialSiteObj._id) ? initialSiteObj : null;

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/sites?project=${projectId}&limit=100`)
      .then(async (r) => r.json())
      .then((j) => {
        if (Array.isArray(j.data)) setSites(j.data);
      })
      .catch(() => {});
  }, [projectId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (description.trim().length < 2) {
      setError("Description is required.");
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
        project: projectId === "" ? null : projectId,
        site: siteId === "" ? null : siteId,
        date: date === "" ? undefined : date,
        category,
        description: description.trim(),
        amount: Number(amount),
        vendor: vendor.trim() === "" ? null : vendor.trim(),
        paymentMethod,
        reference: reference.trim() === "" ? null : reference.trim(),
        notes: notes.trim() === "" ? null : notes.trim(),
      };
      const url = initial ? `/api/expenses/${initial._id}` : "/api/expenses";
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
    <Modal open onClose={onClose} title={initial ? "Edit Expense" : "Add Expense"}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Project (optional)" value={projectId} onChange={(e) => { setProjectId(e.target.value); setSiteId(""); setSites([]); }}>
            <option value="">General (no project)</option>
            {projectOptions.map((p) => (
              <option key={p._id} value={p._id}>{p.name}</option>
            ))}
          </Select>
          <Select label="Site (optional)" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">{projectId ? "No site" : "Pick project first"}</option>
            {lockedSiteOption && (
              <option value={lockedSiteOption._id}>{lockedSiteOption.name}</option>
            )}
            {sites.map((s) => (
              <option key={s._id} value={s._id}>{s.name}</option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Date" required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>
        <Input label="Description" required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Diesel for mixer…" />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Amount (₹)" required type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="2500" />
          <Input label="Vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Vendor name" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Payment Method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </Select>
          <Input label="Reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bill / txn no." />
        </div>
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        {error && (
          <p role="alert" className="text-sm text-danger">{error}</p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : initial ? "Save Changes" : "Add Expense"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
