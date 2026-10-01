"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ComboSelect } from "@/components/ui/combo-select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { cn, formatINR } from "@/lib/utils";
import { Check, Pencil, Search, Trash2, X } from "lucide-react";
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

  function resetPage() {
    setPage(1);
  }

  function clearFilters() {
    setQ("");
    setCategory("");
    setLowOnly(false);
    setPage(1);
  }

  const hasActiveFilters = Boolean(q || category || lowOnly);

  const categoryOptionsPhone = [
    { value: "", label: "All" },
    ...MATERIAL_CATEGORIES.map((c) => ({ value: c, label: c })),
  ];
  const categoryOptionsDesktop = [
    { value: "", label: "All categories" },
    ...MATERIAL_CATEGORIES.map((c) => ({ value: c, label: c })),
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
      <PageHeader
        title="Materials"
        action={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            Add Material
          </Button>
        }
      />

      {/* Phone: shared 2-col grid — search + category share one column width, checkbox + badge the other. */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:hidden">
        <div className="relative min-w-0">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          />
          <Input
            aria-label="Search materials"
            placeholder="Search material…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-9 pl-10 pr-10 text-sm"
          />
          {q && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQ("")}
              className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-text-muted hover:bg-background hover:text-text"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-text">
          <input
            type="checkbox"
            checked={lowOnly}
            onChange={(e) => { setLowOnly(e.target.checked); resetPage(); }}
            aria-label="Low stock only"
            className="peer sr-only"
          />
          <span
            className={cn(
              "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border-2 transition-colors",
              lowOnly
                ? "border-primary bg-primary text-white"
                : "border-border bg-background",
            )}
          >
            {lowOnly && <Check className="h-3 w-3 text-white" />}
          </span>
          <span className="whitespace-nowrap">Low stock</span>
        </label>
        <div className="min-w-0">
          <ComboSelect
            ariaLabel="Filter by category"
            value={category}
            options={categoryOptionsPhone}
            onChange={(v) => { setCategory(v); resetPage(); }}
          />
        </div>
        {data && data.lowCount > 0 && (
          <Badge tone="warning" className="tnum justify-self-end">{data.lowCount} low stock</Badge>
        )}
      </div>

      {/* Desktop: single row — search, checkbox, dropdown right, badge. */}
      <div className="hidden flex-row items-center gap-3 sm:flex">
        <div className="min-w-0 flex-1">
          <Input
            aria-label="Search materials"
            placeholder="Search material, category…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-9 text-sm sm:h-10"
          />
        </div>
      
        <div className="w-44 shrink-0 sm:w-48">
          <ComboSelect
            ariaLabel="Filter by category"
            value={category}
            options={categoryOptionsDesktop}
            onChange={(v) => { setCategory(v); resetPage(); }}
          />
        </div>
          <label className="flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-text sm:h-10">
          <input
            type="checkbox"
            checked={lowOnly}
            onChange={(e) => { setLowOnly(e.target.checked); resetPage(); }}
            aria-label="Low stock only"
            className="peer sr-only"
          />
          <span
            className={cn(
              "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border-2 transition-colors",
              lowOnly
                ? "border-primary bg-primary text-white"
                : "border-border bg-background",
            )}
          >
            {lowOnly && <Check className="h-3 w-3 text-white" />}
          </span>
          Low stock only
        </label>
        {data && data.lowCount > 0 && (
          <Badge tone="warning" className="tnum shrink-0">{data.lowCount} low stock</Badge>
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
          title={hasActiveFilters ? "No materials found" : "No materials yet"}
          description={
            hasActiveFilters
              ? "Try a different search or category — or clear the filters."
              : "Add materials — then record purchases to build stock."
          }
          action={
            hasActiveFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear Search
              </Button>
            ) : (
              <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
                Add Material
              </Button>
            )
          }
        />
      )}

      {!loading && !error && data && data.data.length > 0 && (
        <>
          {/* Phone cards — desktop table below stays untouched. */}
          <ul className="flex flex-col gap-2 sm:hidden">
            {data.data.map((m) => (
              <li key={m._id}>
                <Card className="p-3 active:bg-background">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate text-[15px] font-medium text-text">
                        {m.name}
                      </p>
                      {isLowStock(m) ? (
                        <Badge tone="warning" className="shrink-0">Low Stock</Badge>
                      ) : (
                        <Badge tone="success" className="shrink-0">OK</Badge>
                      )}
                    </div>
                    <p className="min-w-0 truncate text-xs text-text-muted">
                      {m.category}{m.unit ? ` · per ${m.unit}` : " · No unit"} · {formatINR(m.defaultPurchaseRate)}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-[15px] font-semibold tnum text-text">
                        {m.currentStock}{m.unit ? ` ${m.unit}` : ""}
                        <span className="text-xs font-normal text-text-muted"> · Min {m.minimumStock}</span>
                      </p>
                      <div className="-mr-1.5 flex shrink-0 items-center">
                        <button
                          type="button"
                          aria-label={`Edit ${m.name}`}
                          onClick={() => { setEditing(m); setFormOpen(true); }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-primary/10 hover:text-primary"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${m.name}`}
                          onClick={() => { setDeleting(m); setDeleteError(null); }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>

          <div className="hidden sm:block">
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
                        aria-label={`Edit ${m.name}`}
                        title="Edit"
                        onClick={() => { setEditing(m); setFormOpen(true); }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-primary/10 hover:text-primary"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${m.name}`}
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
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted sm:text-sm">
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

  const categorySuggestions = MATERIAL_CATEGORIES.map((c) => ({ value: c, label: c }));
  const unitSuggestions = [
    { value: "", label: "No unit" },
    ...STOCK_UNITS.map((u) => ({ value: u, label: u })),
  ];

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
        <Input label="Material Name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Cement (UltraTech)" disabled={pending} />
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <SuggestInput
            label="Category"
            required
            value={category}
            onChange={setCategory}
            options={categorySuggestions}
            placeholder="Cement"
            disabled={pending}
          />
          <SuggestInput
            label="Unit"
            value={unit}
            onChange={setUnit}
            options={unitSuggestions}
            placeholder="No unit"
            disabled={pending}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Input label="Minimum Stock" type="number" min={0} value={minimumStock} onChange={(e) => setMinimumStock(e.target.value)} disabled={pending} />
          <Input label="Rate (₹/unit)" type="number" min={0} value={rate} onChange={(e) => setRate(e.target.value)} placeholder="380" disabled={pending} />
        </div>
        {!initial && (
          <Input label="Opening Stock (optional)" type="number" min={0} value={openingStock} onChange={(e) => setOpeningStock(e.target.value)} placeholder="Enters ledger as adjustment" disabled={pending} />
        )}
        <Textarea label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={pending} />
        {error && (
          <p role="alert" className="text-sm text-danger">{error}</p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending} className="h-11 sm:h-auto">
            Cancel
          </Button>
          <Button type="submit" disabled={pending} className="h-11 sm:h-auto">
            {pending ? "Saving…" : initial ? "Save Changes" : "Add Material"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Typeable input with suggestion dropdown — type free text or pick from the list. */
function SuggestInput({
  label,
  required,
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  const query = value.trim().toLowerCase();
  const filtered = query === ""
    ? options
    : options.filter((o) => o.label.toLowerCase().includes(query));

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setHighlight(-1);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setHighlight(-1);
  }

  return (
    <div className="flex min-w-0 flex-col gap-1" ref={wrapRef}>
      <label className="text-[13px] font-medium text-text sm:text-sm">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      <div className="relative min-w-0">
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setHighlight(-1);
          }}
          onFocus={() => {
            if (!disabled) {
              setOpen(true);
              setHighlight(-1);
            }
          }}
          onClick={() => {
            if (!disabled) {
              setOpen(true);
              setHighlight(-1);
            }
          }}
          onKeyDown={(e) => {
            if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
              setOpen(true);
              setHighlight(0);
              e.preventDefault();
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter") {
              if (highlight >= 0 && highlight < filtered.length) {
                e.preventDefault();
                pick(filtered[highlight].value);
              }
            } else if (e.key === "Escape") {
              setOpen(false);
              setHighlight(-1);
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          disabled={disabled}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`suggest-${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}
          className="h-11 w-full min-w-0 rounded-md border border-border bg-surface px-3.5 pr-9 text-base text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 sm:h-auto sm:px-3 sm:py-2 sm:text-sm"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-text-muted opacity-60">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4 L6 8 L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        {open && !disabled && filtered.length > 0 && (
          <ul
            id={`suggest-${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}
            role="listbox"
            aria-label={label}
            className="scroll-area absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-auto rounded-md border border-border bg-surface py-1 shadow-md"
          >
            {filtered.map((o, idx) => (
              <li
                key={o.value || "__empty"}
                role="option"
                aria-selected={idx === highlight}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(o.value);
                }}
                onMouseEnter={() => setHighlight(idx)}
                className={`cursor-pointer px-3 py-2 text-sm ${idx === highlight ? "bg-primary/10 text-primary" : o.value === "" ? "text-text-muted" : "text-text"}`}
              >
                {o.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
