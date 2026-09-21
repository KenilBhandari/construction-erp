"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { formatINR } from "@/lib/utils";
import type { MaterialDTO } from "@/types/inventory";
import { isLowStock, MATERIAL_CATEGORIES, STOCK_UNITS } from "@/types/inventory";

interface ListResponse {
  data: MaterialDTO[];
  page: number;
  limit: number;
  total: number;
  lowCount: number;
}

export function MaterialsList() {
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [category, setCategory] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MaterialDTO | null>(null);
  const [deleting, setDeleting] = useState<MaterialDTO | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: "20", sort: "name" });
    if (appliedQ) params.set("q", appliedQ);
    if (category) params.set("category", category);
    if (lowOnly) params.set("lowStock", "true");
    fetch(`/api/materials?${params}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load materials.");
        setData(json);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [appliedQ, category, lowOnly, page, reloadKey]);

  function refresh() {
    setLoading(true);
    setReloadKey((k) => k + 1);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      setAppliedQ(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  async function handleDelete() {
    if (!deleting) return;
    setDeletePending(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/materials/${deleting._id}`, { method: "DELETE" });
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
        title="Materials"
        description="Cement, steel, sand — master list with live stock levels."
        action={
          <div className="flex items-center gap-2">
            {data && data.lowCount > 0 && (
              <Badge tone="warning">{data.lowCount} low stock</Badge>
            )}
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              Add Material
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Input
            aria-label="Search materials"
            placeholder="Search material…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select aria-label="Filter by category" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
          <option value="">All categories</option>
          {MATERIAL_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
        <label className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text">
          <input
            type="checkbox"
            checked={lowOnly}
            onChange={(e) => { setLowOnly(e.target.checked); setPage(1); }}
          />
          Low stock only
        </label>
      </div>

      {loading && <TableSkeleton rows={6} />}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error} <button type="button" className="underline" onClick={refresh}>Retry</button>
        </p>
      )}

      {!loading && !error && data && data.data.length === 0 && (
        <EmptyState
          title="No materials yet"
          description="Add cement, steel, sand and more — then record purchases to build stock."
          action={
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              Add Material
            </Button>
          }
        />
      )}

      {!loading && !error && data && data.data.length > 0 && (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Material</TH>
                <TH>Category</TH>
                <TH numeric>Stock</TH>
                <TH numeric>Min</TH>
                <TH numeric>Rate</TH>
                <TH>Status</TH>
                <TH>Actions</TH>
              </TR>
            </THead>
            <tbody>
              {data.data.map((m) => (
                <TR key={m._id}>
                  <TD>
                    <span className="font-medium">{m.name}</span>
                    <p className="text-xs text-text-muted">per {m.unit}</p>
                  </TD>
                  <TD>{m.category}</TD>
                  <TD numeric>{m.currentStock} {m.unit}</TD>
                  <TD numeric>{m.minimumStock}</TD>
                  <TD numeric>{formatINR(m.defaultPurchaseRate)}</TD>
                  <TD>
                    {isLowStock(m) ? (
                      <Badge tone="warning">Low Stock</Badge>
                    ) : (
                      <Badge tone="success">OK</Badge>
                    )}
                  </TD>
                  <TD>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setEditing(m); setFormOpen(true); }}
                        className="text-sm text-text-muted hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDeleting(m); setDeleteError(null); }}
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
            <p className="tnum">{data.total} material(s) · Page {data.page} of {totalPages}</p>
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
        <MaterialFormModal
          key={editing?._id ?? "new"}
          initial={editing}
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
        title={`Delete ${deleting?.name}?`}
        description={deleteError ?? "Only materials without any transactions can be deleted."}
        pending={deletePending}
      />
    </div>
  );
}

function MaterialFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: MaterialDTO | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "Bag");
  const [minimumStock, setMinimumStock] = useState(initial ? String(initial.minimumStock) : "0");
  const [rate, setRate] = useState(initial ? String(initial.defaultPurchaseRate) : "");
  const [openingStock, setOpeningStock] = useState("");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2 || category.trim().length < 2) {
      setError("Name and category are required.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        category: category.trim(),
        unit,
        minimumStock: minimumStock === "" ? 0 : Number(minimumStock),
        defaultPurchaseRate: rate === "" ? 0 : Number(rate),
        ...(initial ? {} : { openingStock: openingStock === "" ? 0 : Number(openingStock) }),
        notes: notes.trim() === "" ? null : notes.trim(),
      };
      const url = initial ? `/api/materials/${initial._id}` : "/api/materials";
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
    <Modal open onClose={onClose} title={initial ? "Edit Material" : "Add Material"}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <Input label="Material Name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Cement (UltraTech)" />
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="mat-category" className="text-sm font-medium text-text">
              Category <span className="text-danger">*</span>
            </label>
            <input
              id="mat-category"
              list="category-suggestions"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Cement — or type custom"
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
            />
            <datalist id="category-suggestions">
              {MATERIAL_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <Select label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
            {STOCK_UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Minimum Stock" type="number" min={0} value={minimumStock} onChange={(e) => setMinimumStock(e.target.value)} />
          <Input label={`Default Rate (₹/${unit})`} type="number" min={0} value={rate} onChange={(e) => setRate(e.target.value)} placeholder="380" />
        </div>
        {!initial && (
          <Input label="Opening Stock (optional)" type="number" min={0} value={openingStock} onChange={(e) => setOpeningStock(e.target.value)} placeholder="Enters ledger as adjustment" />
        )}
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        {error && (
          <p role="alert" className="text-sm text-danger">{error}</p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : initial ? "Save Changes" : "Add Material"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
