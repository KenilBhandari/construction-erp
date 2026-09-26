"use client";

import { useEffect, useRef, useState } from "react";
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
import { Pencil, Trash2 } from "lucide-react";
import type { MaterialDTO, StockTransactionDTO, TransactionType } from "@/types/inventory";
import { transactionMaterialName } from "@/types/inventory";
import { siteProjectName } from "@/types/site";
import type { SiteDTO } from "@/types/site";

interface ListResponse {
  data: StockTransactionDTO[];
  page: number;
  limit: number;
  total: number;
  totalQuantity: number;
  totalAmount: number;
}

const TYPE_LABEL: Record<TransactionType, string> = {
  purchase: "Purchase",
  consumption: "Used",
  adjustment: "Adjustment",
  return: "Return",
};

const TYPE_TONE: Record<TransactionType, "success" | "neutral" | "warning" | "primary"> = {
  purchase: "success",
  consumption: "neutral",
  adjustment: "warning",
  return: "primary",
};

function detailOf(t: StockTransactionDTO): string {
  if (t.type === "purchase") {
    const bits = [t.unit ? `${formatINR(t.rate)} / ${t.unit}` : formatINR(t.rate)];
    if (t.supplier) bits.push(t.supplier);
    if (t.invoiceNumber) bits.push(`#${t.invoiceNumber}`);
    return bits.join(" · ");
  }
  if (t.type === "consumption") return t.purpose ?? t.notes ?? "—";
  return t.notes ?? "—";
}

/**
 * Shared ledger table. Purchases page fixes types to ["purchase"];
 * Stock page uses consumption/adjustment/return.
 */
export function TransactionsList({
  title,
  description,
  types,
  newLabel,
  headerSuffix,
}: {
  title: string;
  description: string;
  types: TransactionType[];
  newLabel: string;
  headerSuffix?: React.ReactNode;
}) {
  const [materialId, setMaterialId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [materials, setMaterials] = useState<MaterialDTO[]>([]);
  const [sites, setSites] = useState<SiteDTO[]>([]);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StockTransactionDTO | null>(null);
  const [deleting, setDeleting] = useState<StockTransactionDTO | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/materials?limit=100&sort=name")
      .then(async (r) => r.json())
      .then((j) => {
        if (Array.isArray(j.data)) setMaterials(j.data);
      })
      .catch(() => {});
    fetch("/api/sites?limit=100")
      .then(async (r) => r.json())
      .then((j) => {
        if (Array.isArray(j.data)) setSites(j.data);
      })
      .catch(() => {});
  }, []);

  // Stable string — the `types` prop is an inline array literal.
  const typeParam = type || types.join(",");

  useEffect(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
      type: typeParam,
    });
    if (materialId) params.set("material", materialId);
    if (siteId) params.set("site", siteId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`/api/stock?${params}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load transactions.");
        setData(json);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [materialId, siteId, typeParam, from, to, page, reloadKey]);

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
      const res = await fetch(`/api/stock/${deleting._id}`, { method: "DELETE" });
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
  const showTypeColumn = types.length > 1;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={title}
        action={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            {newLabel}
          </Button>
        }
      />

      {headerSuffix}

      <div className={`grid grid-cols-2 items-end gap-3 ${showTypeColumn ? "lg:grid-cols-[1.4fr_1fr_0.9fr_1fr_1fr_auto]" : "lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]"}`}>
        <Select aria-label="Filter by material" value={materialId} onChange={(e) => { setMaterialId(e.target.value); resetPage(); }}>
          <option value="">All materials</option>
          {materials.map((m) => (
            <option key={m._id} value={m._id}>{m.name}</option>
          ))}
        </Select>
        <Select aria-label="Filter by site" value={siteId} onChange={(e) => { setSiteId(e.target.value); resetPage(); }}>
          <option value="">All sites</option>
          {sites.map((s) => (
            <option key={s._id} value={s._id}>{s.name}</option>
          ))}
        </Select>
        {showTypeColumn && (
          <Select aria-label="Filter by type" value={type} onChange={(e) => { setType(e.target.value); resetPage(); }}>
            <option value="">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t]}</option>
            ))}
          </Select>
        )}
        <Input label="From" type="date" value={from} onChange={(e) => { setFrom(e.target.value); resetPage(); }} />
        <Input label="To" type="date" value={to} onChange={(e) => { setTo(e.target.value); resetPage(); }} />
        {(materialId || siteId || type || from || to) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setMaterialId(""); setSiteId(""); setType(""); setFrom(""); setTo(""); resetPage(); }}
          >
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
          title="No entries yet"
          description={description}
          action={
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              {newLabel}
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
                <TH>Material</TH>
                {showTypeColumn && <TH>Type</TH>}
                <TH>Site</TH>
                <TH numeric>Qty</TH>
                <TH>Purpose</TH>
                {types.includes("purchase") && <TH numeric>Amount</TH>}
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <tbody>
              {data.data.map((t) => (
                <TR key={t._id}>
                  <TD className="tnum">{formatDateShort(t.date)}</TD>
                  <TD className="font-medium">{transactionMaterialName(t)}</TD>
                  {showTypeColumn && (
                    <TD>
                      <Badge tone={TYPE_TONE[t.type]}>{TYPE_LABEL[t.type]}</Badge>
                    </TD>
                  )}
                  <TD>
                    {typeof t.site === "string" ? t.site : (t.site?.name ?? "—")}
                  </TD>
                  <TD numeric>
                    {t.type === "consumption" ? "−" : t.type === "adjustment" && t.quantity < 0 ? "" : "+"}
                    {Math.abs(t.quantity)}{t.unit ? ` ${t.unit}` : ""}
                  </TD>
                  <TD>{detailOf(t)}</TD>
                  {types.includes("purchase") && (
                    <TD numeric>{t.type === "purchase" ? formatINR(t.total) : "—"}</TD>
                  )}
                  <TD>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        aria-label="Edit entry"
                        title="Edit"
                        onClick={() => { setEditing(t); setFormOpen(true); }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-primary/10 hover:text-primary"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete entry"
                        title="Delete"
                        onClick={() => { setDeleting(t); setDeleteError(null); }}
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
            <p className="tnum">{data.total} entries{types.includes("purchase") && ` · ${formatINR(data.totalAmount)} total`} · Page {data.page} of {totalPages}</p>
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
        <TransactionFormModal
          key={editing?._id ?? `new-${types.join("-")}`}
          initial={editing}
          allowedTypes={types}
          materialOptions={materials}
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
        title="Delete this entry?"
        description={deleteError ?? "Stock levels adjust back. Blocked only if later entries depend on this stock."}
        pending={deletePending}
      />
    </div>
  );
}

function TransactionFormModal({
  initial,
  allowedTypes,
  materialOptions,
  onClose,
  onSaved,
}: {
  initial: StockTransactionDTO | null;
  allowedTypes: TransactionType[];
  materialOptions: MaterialDTO[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<TransactionType>(
    initial?.type ?? allowedTypes[0],
  );
  const [materialId, setMaterialId] = useState(
    initial ? (typeof initial.material === "string" ? initial.material : initial.material._id) : "",
  );
  const [siteId, setSiteId] = useState(
    initial?.site ? (typeof initial.site === "string" ? initial.site : initial.site._id) : "",
  );
  const [date, setDate] = useState(
    initial ? new Date(initial.date).toISOString().slice(0, 10) : toDateInputValue(),
  );
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : "");
  const [rate, setRate] = useState(initial ? String(initial.rate) : "");
  const [supplier, setSupplier] = useState(initial?.supplier ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState(initial?.invoiceNumber ?? "");
  const [purpose, setPurpose] = useState(initial?.purpose ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [sites, setSites] = useState<SiteDTO[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalMaterials, setModalMaterials] = useState<MaterialDTO[]>([]);
  const [materialQuery, setMaterialQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [matHighlight, setMatHighlight] = useState(-1);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [materialError, setMaterialError] = useState<string | null>(null);
  const matWrapRef = useRef<HTMLDivElement>(null);
  const selectedMaterial = modalMaterials.find((m) => m._id === materialId) ?? materialOptions.find((m) => m._id === materialId);
  const lockedSite = initial && initial.site && typeof initial.site === "object" ? initial.site : null;
  const showLockedSiteOption = !!lockedSite && !sites.some((s) => s._id === (lockedSite as { _id: string })._id);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (matWrapRef.current && !matWrapRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setMatHighlight(-1);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  useEffect(() => {
    fetch("/api/sites?limit=100")
      .then(async (r) => r.json())
      .then((j) => {
        if (Array.isArray(j.data)) setSites(j.data);
      })
      .catch(() => {});
  }, []);

  // Modal-only: fetch 50 on dropdown open, debounced 300 search, no load more
  useEffect(() => {
    if (!dropdownOpen) return;
    setMaterialsLoading(true);
    setMaterialError(null);
    const q = materialQuery.trim();
    const url = q ? `/api/materials?limit=50&sort=name&q=${encodeURIComponent(q)}` : "/api/materials?limit=50&sort=name";
    fetch(url)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Failed to load materials.");
        if (Array.isArray(j.data)) setModalMaterials(j.data);
        else setModalMaterials([]);
      })
      .catch((err: Error) => setMaterialError(err.message))
      .finally(() => setMaterialsLoading(false));
  }, [dropdownOpen]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const t = setTimeout(() => {
      setMaterialsLoading(true);
      setMaterialError(null);
      const q = materialQuery.trim();
      const url = q ? `/api/materials?limit=50&sort=name&q=${encodeURIComponent(q)}` : "/api/materials?limit=50&sort=name";
      fetch(url)
        .then(async (r) => {
          const j = await r.json();
          if (!r.ok) throw new Error(j.error ?? "Failed to load materials.");
          if (Array.isArray(j.data)) setModalMaterials(j.data);
        })
        .catch((err: Error) => setMaterialError(err.message))
        .finally(() => setMaterialsLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [materialQuery]);

  // Prefill purchase rate from the material master (create mode only).
  function onMaterialChange(id: string) {
    setMaterialId(id);
    setMaterialQuery("");
    setDropdownOpen(false);
    setMatHighlight(-1);
    if (!initial && type === "purchase" && rate === "") {
      const m = modalMaterials.find((x) => x._id === id) ?? materialOptions.find((x) => x._id === id);
      if (m) setRate(String(m.defaultPurchaseRate));
    }
  }

  const previewTotal =
    type === "purchase" && quantity !== "" && rate !== ""
      ? Math.round(Number(quantity) * Number(rate))
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!initial && (!materialId || !date)) {
      setError("Material and date are required.");
      return;
    }
    if ((type === "purchase" || type === "consumption") && !initial && !siteId) {
      setError("Site is required for purchases and consumption.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const payload = initial
        ? {
            quantity: quantity === "" ? undefined : Number(quantity),
            rate: rate === "" ? undefined : Number(rate),
            date: date === "" ? undefined : date,
            supplier: supplier.trim() === "" ? null : supplier.trim(),
            invoiceNumber: invoiceNumber.trim() === "" ? null : invoiceNumber.trim(),
            purpose: purpose.trim() === "" ? null : purpose.trim(),
            notes: notes.trim() === "" ? null : notes.trim(),
          }
        : {
            material: materialId,
            site: siteId === "" ? null : siteId,
            date,
            type,
            quantity: Number(quantity),
            rate: rate === "" ? null : Number(rate),
            supplier: supplier.trim() === "" ? null : supplier.trim(),
            invoiceNumber: invoiceNumber.trim() === "" ? null : invoiceNumber.trim(),
            purpose: purpose.trim() === "" ? null : purpose.trim(),
            notes: notes.trim() === "" ? null : notes.trim(),
          };
      const url = initial ? `/api/stock/${initial._id}` : "/api/stock";
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
    <Modal open onClose={onClose} title={initial ? "Edit Entry" : `Record ${TYPE_LABEL[type]}`}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {!initial && (
          <div className="grid grid-cols-2 gap-4">
            <Select label="Type" value={type} onChange={(e) => setType(e.target.value as TransactionType)}>
              {allowedTypes.map((t) => (
                <option key={t} value={t}>{TYPE_LABEL[t]}</option>
              ))}
            </Select>
            <div className="flex flex-col gap-1" ref={matWrapRef}>
              <label htmlFor="txn-material" className="text-sm font-medium text-text">Material <span className="text-danger">*</span></label>
              <div className="relative">
                <input
                  id="txn-material"
                  value={dropdownOpen ? materialQuery : (selectedMaterial?.name ?? "")}
                  onChange={(e) => {
                    setMaterialQuery(e.target.value);
                    setDropdownOpen(true);
                    setMatHighlight(-1);
                  }}
                  onFocus={() => {
                    setDropdownOpen(true);
                    setMatHighlight(-1);
                  }}
                  onClick={() => {
                    setDropdownOpen(true);
                    setMatHighlight(-1);
                  }}
                  onKeyDown={(e) => {
                    if (!dropdownOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                      setDropdownOpen(true);
                      setMatHighlight(0);
                      e.preventDefault();
                      return;
                    }
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setMatHighlight((h) => Math.min(h + 1, modalMaterials.length - 1));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setMatHighlight((h) => Math.max(h - 1, 0));
                    } else if (e.key === "Enter") {
                      if (matHighlight >= 0 && matHighlight < modalMaterials.length) {
                        e.preventDefault();
                        onMaterialChange(modalMaterials[matHighlight]._id);
                      }
                    } else if (e.key === "Escape") {
                      setDropdownOpen(false);
                      setMatHighlight(-1);
                    }
                  }}
                  placeholder="Select material…"
                  autoComplete="off"
                  aria-autocomplete="list"
                  aria-expanded={dropdownOpen}
                  aria-controls="txn-material-suggestions"
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 pr-8 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-text-muted opacity-60">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4 L6 8 L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                {dropdownOpen && (
                  <ul
                    id="txn-material-suggestions"
                    role="listbox"
                    className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-auto rounded-md border border-border bg-surface shadow-md"
                  >
                    {materialsLoading && <li className="px-3 py-2 text-sm text-text-muted">Loading…</li>}
                    {materialError && <li className="px-3 py-2 text-sm text-danger">{materialError}</li>}
                    {!materialsLoading && !materialError && modalMaterials.length === 0 && (
                      <li className="px-3 py-2 text-sm text-text-muted">No materials found.</li>
                    )}
                    {!materialsLoading && !materialError && modalMaterials.map((m, idx) => (
                      <li
                        key={m._id}
                        role="option"
                        aria-selected={idx === matHighlight}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          onMaterialChange(m._id);
                        }}
                        onMouseEnter={() => setMatHighlight(idx)}
                        className={`cursor-pointer px-3 py-2 text-sm ${idx === matHighlight ? "bg-primary/10 text-primary" : materialId === m._id ? "bg-border/30 font-medium text-text" : "text-text hover:bg-background"}`}
                      >
                        <span className="block">{m.name}</span>
                        <span className={`block text-xs ${idx === matHighlight ? "text-primary/70" : "text-text-muted"}`}>{m.currentStock}{m.unit ? ` ${m.unit}` : ""} left · {m.category}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {!dropdownOpen && selectedMaterial && (
                <p className="text-xs text-text-muted tnum">{selectedMaterial.currentStock}{selectedMaterial.unit ? ` ${selectedMaterial.unit}` : ""} left · {selectedMaterial.category}</p>
              )}
            </div>
          </div>
        )}
        {initial && (
          <div className="grid grid-cols-2 gap-4">
            <Input label="Type" value={TYPE_LABEL[initial.type]} disabled />
            <Input label="Material" value={transactionMaterialName(initial)} disabled />
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Input label="Date" required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Select label="Site" required={type === "purchase" || type === "consumption"} value={siteId} onChange={(e) => setSiteId(e.target.value)} disabled={!!initial}>
            <option value="">{type === "purchase" || type === "consumption" ? "Select site…" : "No site"}</option>
            {showLockedSiteOption && lockedSite && (
              <option value={lockedSite._id}>{lockedSite.name}</option>
            )}
            {sites.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} · {siteProjectName(s)}
              </option>
            ))}
          </Select>
        </div>
        <div className={`grid gap-4 ${(type === "purchase" || type === "consumption") ? "grid-cols-2" : "grid-cols-1"}`}>
          <Input
            label={`Quantity${selectedMaterial?.unit ? ` (${selectedMaterial.unit})` : ""}${type === "adjustment" ? " (+/−)" : ""}`}
            required
            type="number"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder={type === "adjustment" ? "-5 to deduct" : "20"}
          />
          {type === "purchase" && (
            <Input label="Rate (₹)" type="number" min={0} step="any" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Defaults to material rate" />
          )}
          {type === "consumption" && (
            <Input label="Purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Slab work" />
          )}
        </div>
        {previewTotal !== null && !Number.isNaN(previewTotal) && (
          <p className="text-sm text-text-muted tnum">Total: {formatINR(previewTotal)}</p>
        )}
        {type === "purchase" && (
          <div className="grid grid-cols-2 gap-4">
            <Input label="Supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Supplier name" />
            <Input label="Invoice #" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="INV-1024" />
          </div>
        )}
        <Textarea
          label={`Notes${type === "adjustment" ? " (required)" : ""}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={type === "adjustment" ? "Reason for correction…" : "Notes…"}
        />
        {error && (
          <p role="alert" className="text-sm text-danger">{error}</p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : initial ? "Save Changes" : `Record ${TYPE_LABEL[type]}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
