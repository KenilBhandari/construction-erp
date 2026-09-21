"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
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
        description="Day-to-day project costs. Salary and stock purchases count automatically — don't re-enter them."
        action={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            Add Expense
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Select aria-label="Filter by project" value={projectId} onChange={(e) => { setProjectId(e.target.value); setSiteId(""); setSites([]); resetPage(); }}>
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p._id} value={p._id}>{p.name}</option>
          ))}
        </Select>
        <Select aria-label="Filter by site" value={siteId} onChange={(e) => { setSiteId(e.target.value); resetPage(); }}>
          <option value="">{projectId ? "All sites" : "Pick project first"}</option>
          {sites.map((s) => (
            <option key={s._id} value={s._id}>{s.name}</option>
          ))}
        </Select>
        <Select aria-label="Filter by category" value={category} onChange={(e) => { setCategory(e.target.value); resetPage(); }}>
          <option value="">All categories</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
        <Input label="From" type="date" value={from} onChange={(e) => { setFrom(e.target.value); resetPage(); }} />
        <Input label="To" type="date" value={to} onChange={(e) => { setTo(e.target.value); resetPage(); }} />
      </div>

      {data && !loading && !error && (
        <p className="text-sm text-text-muted tnum">
          {data.total} expense(s) · {formatINR(data.totalAmount)} total
        </p>
      )}

      {loading && <TableSkeleton rows={6} />}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error} <button type="button" className="underline" onClick={refresh}>Retry</button>
        </p>
      )}

      {!loading && !error && data && data.data.length === 0 && (
        <EmptyState
          title="No expenses yet"
          description="Record transport, equipment, contractor and other site costs."
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
                <TH>Actions</TH>
              </TR>
            </THead>
            <tbody>
              {data.data.map((e) => (
                <TR key={e._id}>
                  <TD className="tnum">{formatDateShort(e.date)}</TD>
                  <TD>
                    <span className="font-medium">{e.description}</span>
                    <p className="text-xs text-text-muted">
                      {[e.vendor, e.paymentMethod].filter(Boolean).join(" · ")}
                    </p>
                  </TD>
                  <TD>
                    {projectName(e)}
                    <p className="text-xs text-text-muted">{siteName(e)}</p>
                  </TD>
                  <TD>
                    <Badge tone="neutral">{e.category}</Badge>
                  </TD>
                  <TD numeric>{formatINR(e.amount)}</TD>
                  <TD>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setEditing(e); setFormOpen(true); }}
                        className="text-sm text-text-muted hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDeleting(e); setDeleteError(null); }}
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

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete this expense?"
        description={deleteError ?? "Project expense totals update automatically."}
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
        <p className="text-xs leading-5 text-text-muted">
          Salary and stock purchases already count toward project cost — log only other spending here.
        </p>
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
