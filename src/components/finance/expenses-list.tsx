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
import type { ExpenseDTO } from "@/types/finance";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "@/types/finance";
import type { SiteDTO } from "@/types/site";
import { useMarkDirtyFor, usePageOneList, useReferenceData } from "@/context/CacheContext";

interface ListResponse {
  data: ExpenseDTO[];
  page: number;
  limit: number;
  total: number;
  totalAmount: number;
}

function siteName(e: ExpenseDTO): string {
  return typeof e.site === "string" ? e.site : (e.site?.name ?? "—");
}

export function ExpensesList() {
  const [siteId, setSiteId] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [sortDir, setSortDir] = useState<DateSortDir>("desc");
  const [reloadKey, setReloadKey] = useState(0);
  // Shared reference cache — no per-page /api/sites fetch.
  const { items: sites } = useReferenceData<SiteDTO>("sites");
  const markDirtyFor = useMarkDirtyFor();
  // Page-1 default-view cache (default sort only). Filtered views fetch fresh.
  const {
    read: readExpensesPage,
    write: writeExpensesPage,
    isDirty: expensesPageDirty,
  } = usePageOneList<ListResponse>("expenses");
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
    // Default view only; manual refresh (reloadKey) always refetches.
    // A refresh fetch still rewrites the cache via isDefault below.
    const isDefault = !siteId && !category && sortDir === "desc" && page === 1;
    const useCache = isDefault && reloadKey === 0;
    if (useCache) {
      const hit = readExpensesPage();
      if (hit) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setData(hit.data);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setError(null);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(false);
        if (!hit.revalidate) return;
      }
    }
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (siteId) params.set("site", siteId);
    if (category) params.set("category", category);
    params.set("sort", dateSortParam(sortDir));
    fetch(`/api/expenses?${params}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load expenses.");
        setData(json);
        setError(null);
        if (isDefault) writeExpensesPage(json);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
    // read/write are scope-bound helpers; isDirty re-runs after mutations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, category, page, sortDir, reloadKey, expensesPageDirty]);

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
      const res = await fetch(`/api/expenses/${deleting._id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Delete failed.");
      setDeleting(null);
      markDirtyFor("expenses");
      refresh();
    } catch (err) {
      setDeleteError((err as Error).message);
    } finally {
      setDeletePending(false);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  const hasActiveFilters = Boolean(siteId || category);

  const siteFilterOptions = [
    { value: "", label: "All sites" },
    ...sites.map((s) => ({ value: s._id, label: s.name })),
  ];
  const categoryFilterOptions = [
    { value: "", label: "All categories" },
    ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c })),
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
      <PageHeader
        title="Expenses"
        action={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            Add Expense
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Spend"
          value={data && !error ? formatINR(data.totalAmount) : "—"}
        />
      </div>

      {/* Phone: site + category side-by-side. */}
      <div className="flex flex-row gap-2 sm:hidden">
        <div className="min-w-0 flex-1">
          <ComboSelect
            ariaLabel="Filter by site"
            value={siteId}
            options={siteFilterOptions}
            onChange={(v) => { setSiteId(v); resetPage(); }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <ComboSelect
            ariaLabel="Filter by category"
            value={category}
            options={categoryFilterOptions}
            onChange={(v) => { setCategory(v); resetPage(); }}
          />
        </div>
      </div>

      {/* Desktop: single row, no visible labels — matches Projects/Sites/Labour. */}
      <div className="hidden sm:flex sm:flex-row sm:items-center sm:gap-3">
        <div className="min-w-0 flex-1">
          <ComboSelect
            ariaLabel="Filter by site"
            value={siteId}
            options={siteFilterOptions}
            onChange={(v) => { setSiteId(v); resetPage(); }}
          />
        </div>
        <div className="w-44 shrink-0 sm:w-48">
          <ComboSelect
            ariaLabel="Filter by category"
            value={category}
            options={categoryFilterOptions}
            onChange={(v) => { setCategory(v); resetPage(); }}
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
          title={hasActiveFilters ? "No entries found" : "No expenses yet"}
          description={
            hasActiveFilters
              ? "Try different filters."
              : "Record site and general expenses to track spend."
          }
          action={
            hasActiveFilters ? undefined : (
              <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
                Add Expense
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
            {data.data.map((e) => {
              const site = siteName(e);
              return (
                <li key={e._id}>
                  <Card className="cursor-pointer p-3 active:bg-background">
                    <div
                      className="flex flex-col gap-1.5"
                      onClick={() => setViewing(e)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 flex-1 truncate text-[15px] font-medium text-text">
                          {e.description}
                        </p>
                        <Badge tone="neutral" className="shrink-0">{e.category}</Badge>
                      </div>
                      <p className="min-w-0 truncate text-xs text-text-muted tnum">
                        {formatDateShort(e.date)}{site === "—" ? "" : ` · ${site}`}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-[15px] font-semibold tnum text-text">
                          {formatINR(e.amount)}
                        </p>
                        <div className="-mr-1.5 flex shrink-0 items-center" onClick={(ev) => ev.stopPropagation()}>
                          <button
                            type="button"
                            aria-label={`Edit ${e.description}`}
                            onClick={() => { setEditing(e); setFormOpen(true); }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-primary/10 hover:text-primary"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${e.description}`}
                            onClick={() => { setDeleting(e); setDeleteError(null); }}
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
                  <TH>Description</TH>
                  <TH>Site</TH>
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
                    <TD className="max-w-[200px] truncate" title={site}>
                      {site}
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
        <ExpenseFormModal
          key={editing?._id ?? "new"}
          initial={editing}
          siteOptions={sites}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            markDirtyFor("expenses");
            refresh();
          }}
        />
      )}

      {viewing && (
        <ExpenseDetailModal e={viewing} onClose={() => setViewing(null)} />
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

function ExpenseDetailModal({ e, onClose }: { e: ExpenseDTO; onClose: () => void }) {
  const site = siteName(e);
  const rows: { label: string; value: string }[] = [
    { label: "Date", value: formatDateShort(e.date) },
    { label: "Site", value: site },
    { label: "Category", value: e.category },
    { label: "Vendor", value: e.vendor ?? "—" },
    { label: "Payment Method", value: e.paymentMethod },
  ];
  if (e.reference) rows.push({ label: "Reference", value: e.reference });

  return (
    <Modal open onClose={onClose} title={e.description} size="lg">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge tone="neutral" className="self-start">{e.category}</Badge>
          <p className="text-sm font-semibold tnum text-text">{formatINR(e.amount)}</p>
        </div>
        <dl className="divide-y divide-border rounded-md border border-border">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3 px-3 py-2">
              <dt className="shrink-0 text-[13px] text-text-muted">{r.label}</dt>
              <dd className="min-w-0 truncate text-right text-sm font-medium text-text tnum">{r.value}</dd>
            </div>
          ))}
        </dl>
        {e.notes && (
          <div className="flex flex-col gap-1">
            <p className="text-[13px] text-text-muted">Notes</p>
            <p className="text-sm leading-6 text-text">{e.notes}</p>
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

function ExpenseFormModal({
  initial,
  siteOptions,
  onClose,
  onSaved,
}: {
  initial: ExpenseDTO | null;
  siteOptions: SiteDTO[];
  onClose: () => void;
  onSaved: () => void;
}) {
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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Locked option keeps the edit-mode site visible even if the
  // list fetch hasn't returned it yet.
  const initialSiteObj =
    initial && initial.site && typeof initial.site === "object" ? initial.site : null;

  const siteSelectOptions = [
    { value: "", label: "No site" },
    ...(initialSiteObj && !siteOptions.some((s) => s._id === initialSiteObj._id)
      ? [{ value: initialSiteObj._id, label: initialSiteObj.name }]
      : []),
    ...siteOptions.map((s) => ({ value: s._id, label: s.name })),
  ];

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
        project: null,
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
        <div className="min-w-0">
          <ComboSelect
            label="Site"
            value={siteId}
            options={siteSelectOptions}
            onChange={setSiteId}
            disabled={pending}
            triggerClassName="h-11 text-base sm:h-[38px] sm:text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-4">
          <div className="min-w-0">
            <DateField label="Date" required value={date} onChange={setDate} disabled={pending} />
          </div>
          <div className="min-w-0">
            <ComboSelect
              label="Category"
              value={category}
              options={EXPENSE_CATEGORIES.filter((c) => c !== "WRITE_OFF").map((c) => ({ value: c, label: c }))}
              onChange={setCategory}
              disabled={pending}
              triggerClassName="h-11 text-base sm:h-[38px] sm:text-sm"
            />
          </div>
        </div>
        <Input label="Description" required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Diesel for mixer…" disabled={pending} />
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-4">
          <div className="min-w-0">
            <Input label="Amount (₹)" required type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="2500" disabled={pending} />
          </div>
          <div className="min-w-0">
            <Input label="Vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Vendor name" disabled={pending} />
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
            <Input label="Reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bill / txn no." disabled={pending} />
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
            {pending ? "Saving…" : initial ? "Save Changes" : "Add Expense"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
