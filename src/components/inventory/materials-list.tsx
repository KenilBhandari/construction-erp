"use client";

import { useEffect, useRef, useState } from "react";
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
import { Pencil, Trash2 } from "lucide-react";
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
        action={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            Add Material
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-64 sm:shrink-0">
          <Input
            aria-label="Search materials"
            placeholder="Search material…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="sm:w-44 sm:shrink-0">
          <Select aria-label="Filter by category" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
            <option value="">All categories</option>
            {MATERIAL_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>
        <label className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text sm:shrink-0">
          <input
            type="checkbox"
            checked={lowOnly}
            onChange={(e) => { setLowOnly(e.target.checked); setPage(1); }}
          />
          Low stock only
        </label>
        <div className="flex items-center gap-3 sm:ml-auto">
          {data && data.lowCount > 0 && (
            <Badge tone="warning" className="tnum">{data.lowCount} low stock</Badge>
          )}
          {(q || category || lowOnly) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setQ(""); setCategory(""); setLowOnly(false); setPage(1); }}
            >
              Clear
            </Button>
          )}
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
          title="No materials yet"
          description="Add materials — then record purchases to build stock."
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
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <tbody>
              {data.data.map((m) => (
                <TR key={m._id}>
                  <TD>
                    <span className="font-medium">{m.name}</span>
                    <p className="text-xs text-text-muted">{m.unit ? `per ${m.unit}` : "No unit"}</p>
                  </TD>
                  <TD>{m.category}</TD>
                  <TD numeric>{m.currentStock}{m.unit ? ` ${m.unit}` : ""}</TD>
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
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        aria-label="Edit material"
                        title="Edit"
                        onClick={() => { setEditing(m); setFormOpen(true); }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-primary/10 hover:text-primary"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete material"
                        title="Delete"
                        onClick={() => { setDeleting(m); setDeleteError(null); }}
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
        description={deleteError ?? (deleting ? `Deletes ${deleting.name} permanently. Only possible with no transactions.` : "Deletes the material permanently.")}
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
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [minimumStock, setMinimumStock] = useState(initial ? String(initial.minimumStock) : "0");
  const [rate, setRate] = useState(initial ? String(initial.defaultPurchaseRate) : "");
  const [openingStock, setOpeningStock] = useState("");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catOpen, setCatOpen] = useState(false);
  const [catHighlight, setCatHighlight] = useState(-1);
  const [unitOpen, setUnitOpen] = useState(false);
  const [unitHighlight, setUnitHighlight] = useState(-1);
  const catWrapRef = useRef<HTMLDivElement>(null);
  const unitWrapRef = useRef<HTMLDivElement>(null);

  const filteredCategories = category.trim() === ""
    ? [...MATERIAL_CATEGORIES]
    : MATERIAL_CATEGORIES.filter((c) => c.toLowerCase().includes(category.trim().toLowerCase()));
  const filteredUnits = unit.trim() === ""
    ? [...STOCK_UNITS]
    : STOCK_UNITS.filter((u) => u.toLowerCase().includes(unit.trim().toLowerCase()));

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (catWrapRef.current && !catWrapRef.current.contains(e.target as Node)) {
        setCatOpen(false);
        setCatHighlight(-1);
      }
      if (unitWrapRef.current && !unitWrapRef.current.contains(e.target as Node)) {
        setUnitOpen(false);
        setUnitHighlight(-1);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2 || category.trim().length < 2) {
      setError("Name and category are required.");
      return;
    }
    if (unit !== "" && !(STOCK_UNITS as readonly string[]).includes(unit)) {
      setError("Pick a unit from the list or leave it empty.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        category: category.trim(),
        unit: unit === "" ? null : unit,
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
          <div className="flex flex-col gap-1" ref={catWrapRef}>
            <label htmlFor="mat-category" className="text-sm font-medium text-text">
              Category <span className="text-danger">*</span>
            </label>
            <div className="relative">
              <input
                id="mat-category"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setCatOpen(true);
                  setCatHighlight(-1);
                }}
                onFocus={() => {
                  setCatOpen(true);
                  setCatHighlight(-1);
                }}
                onClick={() => {
                  setCatOpen(true);
                  setCatHighlight(-1);
                }}
                onKeyDown={(e) => {
                  if (!catOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                    setCatOpen(true);
                    setCatHighlight(0);
                    e.preventDefault();
                    return;
                  }
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setCatHighlight((h) => Math.min(h + 1, filteredCategories.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setCatHighlight((h) => Math.max(h - 1, 0));
                  } else if (e.key === "Enter") {
                    if (catHighlight >= 0 && catHighlight < filteredCategories.length) {
                      e.preventDefault();
                      setCategory(filteredCategories[catHighlight]);
                      setCatOpen(false);
                      setCatHighlight(-1);
                    }
                  } else if (e.key === "Escape") {
                    setCatOpen(false);
                    setCatHighlight(-1);
                  }
                }}
                placeholder="Cement"
                autoComplete="off"
                aria-autocomplete="list"
                aria-expanded={catOpen}
                aria-controls="mat-category-suggestions"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 pr-8 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-text-muted opacity-60">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4 L6 8 L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              {catOpen && filteredCategories.length > 0 && (
                <ul
                  id="mat-category-suggestions"
                  role="listbox"
                  className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-auto rounded-md border border-border bg-surface shadow-md"
                >
                  {filteredCategories.map((c, idx) => (
                    <li
                      key={c}
                      role="option"
                      aria-selected={idx === catHighlight}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setCategory(c);
                        setCatOpen(false);
                        setCatHighlight(-1);
                      }}
                      onMouseEnter={() => setCatHighlight(idx)}
                      className={`cursor-pointer px-3 py-2 text-sm ${idx === catHighlight ? "bg-primary/10 text-primary" : "text-text hover:bg-background"}`}
                    >
                      {c}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1" ref={unitWrapRef}>
            <label htmlFor="mat-unit" className="text-sm font-medium text-text">
              Unit
            </label>
            <div className="relative">
              <input
                id="mat-unit"
                value={unit}
                onChange={(e) => {
                  setUnit(e.target.value);
                  setUnitOpen(true);
                  setUnitHighlight(-1);
                }}
                onFocus={() => {
                  setUnitOpen(true);
                  setUnitHighlight(-1);
                }}
                onClick={() => {
                  setUnitOpen(true);
                  setUnitHighlight(-1);
                }}
                onKeyDown={(e) => {
                  const options = ["", ...filteredUnits];
                  if (!unitOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                    setUnitOpen(true);
                    setUnitHighlight(0);
                    e.preventDefault();
                    return;
                  }
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setUnitHighlight((h) => Math.min(h + 1, options.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setUnitHighlight((h) => Math.max(h - 1, 0));
                  } else if (e.key === "Enter") {
                    if (unitHighlight >= 0 && unitHighlight < options.length) {
                      e.preventDefault();
                      setUnit(options[unitHighlight]);
                      setUnitOpen(false);
                      setUnitHighlight(-1);
                    }
                  } else if (e.key === "Escape") {
                    setUnitOpen(false);
                    setUnitHighlight(-1);
                  }
                }}
                placeholder="No unit"
                autoComplete="off"
                aria-autocomplete="list"
                aria-expanded={unitOpen}
                aria-controls="mat-unit-suggestions"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 pr-8 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-text-muted opacity-60">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4 L6 8 L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              {unitOpen && (
                <ul
                  id="mat-unit-suggestions"
                  role="listbox"
                  className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-auto rounded-md border border-border bg-surface shadow-md"
                >
                  <li
                    role="option"
                    aria-selected={unitHighlight === 0}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setUnit("");
                      setUnitOpen(false);
                      setUnitHighlight(-1);
                    }}
                    onMouseEnter={() => setUnitHighlight(0)}
                    className={`cursor-pointer px-3 py-2 text-sm ${unitHighlight === 0 ? "bg-primary/10 text-primary" : "text-text-muted hover:bg-background"}`}
                  >
                    No unit
                  </li>
                  {filteredUnits.map((u, idx) => (
                    <li
                      key={u}
                      role="option"
                      aria-selected={idx + 1 === unitHighlight}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setUnit(u);
                        setUnitOpen(false);
                        setUnitHighlight(-1);
                      }}
                      onMouseEnter={() => setUnitHighlight(idx + 1)}
                      className={`cursor-pointer px-3 py-2 text-sm ${idx + 1 === unitHighlight ? "bg-primary/10 text-primary" : "text-text hover:bg-background"}`}
                    >
                      {u}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Minimum Stock" type="number" min={0} value={minimumStock} onChange={(e) => setMinimumStock(e.target.value)} />
          <Input label={unit ? `Default Rate (₹/${unit})` : "Default Rate (₹)"} type="number" min={0} value={rate} onChange={(e) => setRate(e.target.value)} placeholder="380" />
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
