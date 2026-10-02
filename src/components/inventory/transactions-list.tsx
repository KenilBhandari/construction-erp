"use client";

import { useEffect, useRef, useState } from "react";
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
import { Check, ChevronDown, Pencil, Trash2 } from "lucide-react";
import type { MaterialDTO, StockTransactionDTO, TransactionType } from "@/types/inventory";
import { transactionMaterialName } from "@/types/inventory";
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

/** Verbose action titles for modal headers — "Used" badge becomes "Usage" here. */
const TYPE_ACTION_LABEL: Record<TransactionType, string> = {
  purchase: "Purchase",
  consumption: "Usage",
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

function siteNameOf(t: StockTransactionDTO): string {
  if (typeof t.site === "string") return t.site === "" ? "Unassigned" : t.site;
  return t.site?.name ?? "Unassigned";
}

function qtyDisplay(t: StockTransactionDTO): string {
  const sign = t.type === "consumption" ? "−" : t.type === "adjustment" && t.quantity < 0 ? "" : "+";
  return `${sign}${Math.abs(t.quantity)}${t.unit ? ` ${t.unit}` : ""}`;
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
  description?: string;
  types: TransactionType[];
  newLabel: string;
  headerSuffix?: React.ReactNode;
}) {
  const [materialId, setMaterialId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [sortDir, setSortDir] = useState<DateSortDir>("desc");
  const [reloadKey, setReloadKey] = useState(0);
  const [materials, setMaterials] = useState<MaterialDTO[]>([]);
  const [sites, setSites] = useState<SiteDTO[]>([]);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StockTransactionDTO | null>(null);
  const [deleting, setDeleting] = useState<StockTransactionDTO | null>(null);
  const [detail, setDetail] = useState<StockTransactionDTO | null>(null);
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
  const sortParam = dateSortParam(sortDir);

  useEffect(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
      type: typeParam,
    });
    if (materialId) params.set("material", materialId);
    if (siteId) params.set("site", siteId);
    params.set("sort", sortParam);
    fetch(`/api/stock?${params}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load transactions.");
        setData(json);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [materialId, siteId, typeParam, sortParam, page, reloadKey]);

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

  const hasActiveFilters = Boolean(materialId || siteId || type);

  function clearAllFilters() {
    setMaterialId("");
    setSiteId("");
    setType("");
    resetPage();
  }

  const materialFilterOptions = [
    { value: "", label: "All materials" },
    ...materials.map((m) => ({ value: m._id, label: m.name })),
  ];
  const siteFilterOptions = [
    { value: "", label: "All sites" },
    ...sites.map((s) => ({ value: s._id, label: s.name })),
  ];
  const typeFilterOptions = [
    { value: "", label: "All types" },
    ...types.map((t) => ({ value: t, label: TYPE_LABEL[t] })),
  ];
  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
      <PageHeader
        title={title}
        action={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            {newLabel}
          </Button>
        }
      />

      {headerSuffix}

      {types.includes("purchase") && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            label="Total Purchases"
            value={data && !error ? formatINR(data.totalAmount) : "—"}
          />
        </div>
      )}

      {/* Phone: Purchases (2 filters) side-by-side in one row; Stock (3 filters) keeps material+type row with site below. */}
      {!showTypeColumn ? (
        <div className="flex flex-row gap-2 sm:hidden">
          <div className="min-w-0 flex-1">
            <ComboSelect
              ariaLabel="Filter by material"
              value={materialId}
              options={materialFilterOptions}
              onChange={(v) => { setMaterialId(v); resetPage(); }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <ComboSelect
              ariaLabel="Filter by site"
              value={siteId}
              options={siteFilterOptions}
              onChange={(v) => { setSiteId(v); resetPage(); }}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:hidden">
          <div className="flex flex-row gap-2">
            <div className="min-w-0 flex-1">
              <ComboSelect
                ariaLabel="Filter by material"
                value={materialId}
                options={materialFilterOptions}
                onChange={(v) => { setMaterialId(v); resetPage(); }}
              />
            </div>
            <div className="w-[132px] shrink-0">
              <ComboSelect
                ariaLabel="Filter by type"
                value={type}
                options={[{ value: "", label: "All" }, ...types.map((t) => ({ value: t, label: TYPE_LABEL[t] }))]}
                onChange={(v) => { setType(v); resetPage(); }}
              />
            </div>
          </div>
          <div className="min-w-0">
            <ComboSelect
              ariaLabel="Filter by site"
              value={siteId}
              options={siteFilterOptions}
              onChange={(v) => { setSiteId(v); resetPage(); }}
            />
          </div>
        </div>
      )}

      {/* Desktop: single row, no visible labels — matches Projects/Sites/Labour. */}
      <div className="hidden sm:flex sm:flex-row sm:gap-3">
        <div className="min-w-0 flex-1">
          <ComboSelect
            ariaLabel="Filter by material"
            value={materialId}
            options={materialFilterOptions}
            onChange={(v) => { setMaterialId(v); resetPage(); }}
          />
        </div>
        <div className="w-44 shrink-0 sm:w-48">
          <ComboSelect
            ariaLabel="Filter by site"
            value={siteId}
            options={siteFilterOptions}
            onChange={(v) => { setSiteId(v); resetPage(); }}
          />
        </div>
        {showTypeColumn && (
          <div className="w-44 shrink-0">
            <ComboSelect
              ariaLabel="Filter by type"
              value={type}
              options={typeFilterOptions}
              onChange={(v) => { setType(v); resetPage(); }}
            />
          </div>
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
          title={hasActiveFilters ? "No entries found" : "No entries yet"}
          description={
            hasActiveFilters
              ? "Try different filters — or clear them."
              : (description ?? "Record usage, returns or corrections to track stock.")
          }
          action={
            hasActiveFilters ? (
              <Button variant="outline" onClick={clearAllFilters}>
                Clear Filters
              </Button>
            ) : (
              <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
                {newLabel}
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
            {data.data.map((t) => {
              const siteName = siteNameOf(t);
              const detail = detailOf(t);
              return (
              <li key={t._id}>
                <Card className="cursor-pointer p-3 active:bg-background">
                  <div
                    className="flex flex-col gap-1.5"
                    onClick={() => setDetail(t)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate text-[15px] font-medium text-text">
                        {transactionMaterialName(t)}
                      </p>
                      <Badge tone={TYPE_TONE[t.type]} className="shrink-0">{TYPE_LABEL[t.type]}</Badge>
                    </div>
                    <p className="min-w-0 truncate text-xs text-text-muted tnum">
                      {formatDateShort(t.date)} · {siteName}{detail !== "—" ? ` · ${detail}` : ""}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-[15px] font-semibold tnum text-text">
                        {qtyDisplay(t)}
                      </p>
                      <div className="-mr-1.5 flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          aria-label={`Edit ${transactionMaterialName(t)}`}
                          onClick={() => { setEditing(t); setFormOpen(true); }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-primary/10 hover:text-primary"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${transactionMaterialName(t)}`}
                          onClick={() => { setDeleting(t); setDeleteError(null); }}
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
                <TR
                  key={t._id}
                  className="cursor-pointer hover:bg-background/70"
                  onClick={() => setDetail(t)}
                >
                  <TD className="tnum">{formatDateShort(t.date)}</TD>
                  <TD className="font-medium">{transactionMaterialName(t)}</TD>
                  {showTypeColumn && (
                    <TD>
                      <Badge tone={TYPE_TONE[t.type]}>{TYPE_LABEL[t.type]}</Badge>
                    </TD>
                  )}
                  <TD className={siteNameOf(t) === "Unassigned" ? "text-text-muted italic" : ""}>
                    {siteNameOf(t)}
                  </TD>
                  <TD numeric>
                    {qtyDisplay(t)}
                  </TD>
                  <TD>{detailOf(t)}</TD>
                  {types.includes("purchase") && (
                    <TD numeric>{t.type === "purchase" ? formatINR(t.total) : "—"}</TD>
                  )}
                  <TD>
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        aria-label={`Edit ${transactionMaterialName(t)}`}
                        title="Edit"
                        onClick={() => { setEditing(t); setFormOpen(true); }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-primary/10 hover:text-primary"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${transactionMaterialName(t)}`}
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

      {detail && (
        <TransactionDetailModal t={detail} onClose={() => setDetail(null)} />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete this entry?"
        description={deleteError ?? "Stock levels adjust back."}
        pending={deletePending}
      />
    </div>
  );
}

function TransactionDetailModal({ t, onClose }: { t: StockTransactionDTO; onClose: () => void }) {
  const rows: { label: string; value: string }[] = [
    { label: "Date", value: formatDateShort(t.date) },
    { label: "Site", value: siteNameOf(t) },
    { label: "Quantity", value: qtyDisplay(t) },
  ];
  if (t.type === "purchase") {
    rows.push({ label: "Rate", value: t.unit ? `${formatINR(t.rate)} / ${t.unit}` : formatINR(t.rate) });
    rows.push({ label: "Total", value: formatINR(t.total) });
    if (t.supplier) rows.push({ label: "Supplier", value: t.supplier });
    if (t.invoiceNumber) rows.push({ label: "Invoice #", value: t.invoiceNumber });
  }

  return (
    <Modal open onClose={onClose} title={transactionMaterialName(t)}>
      <div className="flex flex-col gap-4">
        <Badge tone={TYPE_TONE[t.type]} className="self-start">{TYPE_LABEL[t.type]}</Badge>
        <dl className="divide-y divide-border rounded-md border border-border">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3 px-3 py-2">
              <dt className="shrink-0 text-[13px] text-text-muted">{r.label}</dt>
              <dd className="min-w-0 truncate text-right text-sm font-medium text-text tnum">{r.value}</dd>
            </div>
          ))}
        </dl>
        {t.type === "consumption" && t.purpose && (
          <div className="flex flex-col gap-1">
            <p className="text-[13px] text-text-muted">Purpose</p>
            <p className="text-sm text-text">{t.purpose}</p>
          </div>
        )}
        {t.notes && (
          <div className="flex flex-col gap-1">
            <p className="text-[13px] text-text-muted">Notes</p>
            <p className="text-sm leading-6 text-text">{t.notes}</p>
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

  // Modal-only: fetch 50 when the dropdown opens, debounced 300ms while searching. No load more.
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
          else setModalMaterials([]);
        })
        .catch((err: Error) => setMaterialError(err.message))
        .finally(() => setMaterialsLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [dropdownOpen, materialQuery]);

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
    <Modal open onClose={onClose} title={initial ? `Edit ${TYPE_ACTION_LABEL[initial.type]}` : `Record ${TYPE_ACTION_LABEL[type]}`}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {!initial && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-4">
            {allowedTypes.length > 1 && (
              <div className="min-w-0">
                <ComboSelect
                  label="Type"
                  value={type}
                  options={allowedTypes.map((t) => ({ value: t, label: TYPE_ACTION_LABEL[t] }))}
                  onChange={(v) => setType(v as TransactionType)}
                  disabled={pending}
                  triggerClassName="h-11 text-base sm:h-[38px] sm:text-sm"
                />
              </div>
            )}
            <div className={`flex min-w-0 flex-col gap-1 ${allowedTypes.length <= 1 ? "col-span-2" : ""}`} ref={matWrapRef}>
              <label htmlFor="txn-material" className="text-[13px] font-medium text-text sm:text-sm">Material <span className="text-danger">*</span></label>
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
                  disabled={pending}
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={dropdownOpen}
                  aria-controls="txn-material-suggestions"
                  className="h-11 w-full min-w-0 rounded-md border border-border bg-surface px-3.5 pr-9 text-base text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50 sm:h-auto sm:px-3 sm:py-2 sm:text-sm"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-text-muted">
                  <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                </span>
                {dropdownOpen && (
                  <ul
                    id="txn-material-suggestions"
                    role="listbox"
                    className="scroll-area absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-xl"
                  >
                    {materialsLoading && <li className="px-2.5 py-2 text-sm text-text-muted">Loading…</li>}
                    {materialError && <li className="px-2.5 py-2 text-sm text-danger">{materialError}</li>}
                    {!materialsLoading && !materialError && modalMaterials.length === 0 && (
                      <li className="px-2.5 py-2 text-sm text-text-muted">No materials found.</li>
                    )}
                    {!materialsLoading && !materialError && modalMaterials.map((m, idx) => {
                      const isSelected = m._id === materialId;
                      const isHighlight = idx === matHighlight;
                      return (
                      <li
                        key={m._id}
                        role="option"
                        aria-selected={isSelected}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          onMaterialChange(m._id);
                        }}
                        onMouseEnter={() => setMatHighlight(idx)}
                        className={`flex min-h-9 cursor-pointer items-center justify-between gap-2 px-2.5 text-sm ${isHighlight ? "bg-primary/10 text-primary" : "text-text"}`}
                      >
                        <span className="min-w-0 flex-1 truncate">{m.name}</span>
                        {isSelected && (
                          <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                        )}
                      </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
        {initial && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-4">
            <div className="min-w-0">
              <Input label="Type" value={TYPE_LABEL[initial.type]} disabled />
            </div>
            <div className="min-w-0">
              <Input label="Material" value={transactionMaterialName(initial)} disabled />
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-4">
          <div className="min-w-0">
            <DateField label="Date" required value={date} onChange={setDate} disabled={pending} />
          </div>
          <div className="min-w-0">
            <ComboSelect
              label="Site"
              required={type === "purchase" || type === "consumption"}
              value={siteId}
              options={[
                { value: "", label: type === "purchase" || type === "consumption" ? "Select site…" : "No site" },
                ...(showLockedSiteOption && lockedSite
                  ? [{ value: lockedSite._id, label: lockedSite.name }]
                  : []),
                ...sites.map((s) => ({ value: s._id, label: s.name })),
              ]}
              onChange={setSiteId}
              disabled={pending || !!initial}
              triggerClassName="h-11 text-base sm:h-[38px] sm:text-sm"
            />
          </div>
        </div>
        <div className={`grid gap-x-3 gap-y-4 sm:gap-4 ${(type === "purchase" || type === "consumption") ? "grid-cols-2" : "grid-cols-1"}`}>
          <div className="min-w-0">
            <Input
              label={`Quantity${selectedMaterial?.unit ? ` (${selectedMaterial.unit})` : ""}${type === "adjustment" ? " (+/−)" : ""}`}
              required
              type="number"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={type === "adjustment" ? "-5 to deduct" : "20"}
              disabled={pending}
            />
          </div>
          {type === "purchase" && (
            <div className="min-w-0">
              <Input label={selectedMaterial?.unit ? `Rate (₹/${selectedMaterial.unit})` : "Rate (₹/unit)"} type="number" min={0} step="any" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Defaults to material rate" disabled={pending} />
            </div>
          )}
          {type === "consumption" && (
            <div className="min-w-0">
              <Input label="Purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Slab work" disabled={pending} />
            </div>
          )}
        </div>
        {previewTotal !== null && !Number.isNaN(previewTotal) && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
            <p className="shrink-0 text-[13px] text-text-muted">Total</p>
            <p className="min-w-0 truncate text-right text-sm font-semibold text-text tnum">{formatINR(previewTotal)}</p>
          </div>
        )}
        {type === "purchase" && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-4">
            <div className="min-w-0">
              <Input label="Supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Supplier name" disabled={pending} />
            </div>
            <div className="min-w-0">
              <Input label="Invoice #" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="INV-1024" disabled={pending} />
            </div>
          </div>
        )}
        <Textarea
          label={`Notes${type === "adjustment" ? " (required)" : ""}`}
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={type === "adjustment" ? "Reason for correction…" : "Notes…"}
          disabled={pending}
        />
        {error && (
          <p role="alert" className="text-sm text-danger">{error}</p>
        )}
        <div className="flex flex-row justify-end gap-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pb-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending} className="h-11 sm:h-auto">
            Cancel
          </Button>
          <Button type="submit" disabled={pending} className="h-11 sm:h-auto">
            {pending ? "Saving…" : initial ? "Save Changes" : `Record ${TYPE_ACTION_LABEL[type]}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
