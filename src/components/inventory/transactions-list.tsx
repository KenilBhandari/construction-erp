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
import type { MaterialDTO, StockTransactionDTO, TransactionType } from "@/types/inventory";
import { transactionMaterialName } from "@/types/inventory";
import { siteProjectName } from "@/types/site";
import type { ProjectDTO } from "@/types/project";
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
    const bits = [`${formatINR(t.rate)} / ${t.unit}`];
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
}: {
  title: string;
  description: string;
  types: TransactionType[];
  newLabel: string;
}) {
  const [materialId, setMaterialId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [materials, setMaterials] = useState<MaterialDTO[]>([]);
  const [projects, setProjects] = useState<ProjectDTO[]>([]);
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
        console.log(materials, "maeakewrio");
        
      })
      .catch(() => {});
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

  // Stable string — the `types` prop is an inline array literal.
  const typeParam = type || types.join(",");

  useEffect(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
      type: typeParam,
    });
    if (materialId) params.set("material", materialId);
    if (projectId) params.set("project", projectId);
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
  }, [materialId, projectId, siteId, typeParam, from, to, page, reloadKey]);

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
        description={description}
        action={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            {newLabel}
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Select aria-label="Filter by material" value={materialId} onChange={(e) => { setMaterialId(e.target.value); resetPage(); }}>
          <option value="">All materials</option>
          {materials.map((m) => (
            <option key={m._id} value={m._id}>{m.name}</option>
          ))}
        </Select>
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
      </div>

      {data && !loading && !error && (
        <p className="text-sm text-text-muted tnum">
          {data.total} entries
          {types.includes("purchase") && ` · ${formatINR(data.totalAmount)} total`}
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
                <TH>Detail</TH>
                {types.includes("purchase") && <TH numeric>Amount</TH>}
                <TH>Actions</TH>
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
                    {Math.abs(t.quantity)} {t.unit}
                  </TD>
                  <TD>{detailOf(t)}</TD>
                  {types.includes("purchase") && (
                    <TD numeric>{t.type === "purchase" ? formatINR(t.total) : "—"}</TD>
                  )}
                  <TD>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setEditing(t); setFormOpen(true); }}
                        className="text-sm text-text-muted hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDeleting(t); setDeleteError(null); }}
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
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [materialError, setMaterialError] = useState<string | null>(null);
  const selectedMaterial = modalMaterials.find((m) => m._id === materialId) ?? materialOptions.find((m) => m._id === materialId);

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
    if (!initial && type === "purchase" && rate === "") {
      const m = materialOptions.find((x) => x._id === id);
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
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text">Material <span className="text-danger">*</span></label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDropdownOpen((o) => !o)}
                  className="flex w-full items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
                >
                  <span className={selectedMaterial ? "text-text" : "text-text-muted"}>
                    {selectedMaterial ? `${selectedMaterial.name} — ${selectedMaterial.currentStock} ${selectedMaterial.unit} left` : "Select material…"}
                  </span>
                  <span className="text-text-muted">▾</span>
                </button>
                {dropdownOpen && (
                  <div className="absolute left-0 right-0 z-10 mt-1 rounded-md border border-border bg-surface shadow-lg">
                    <div className="p-2">
                      <Input
                        autoFocus
                        placeholder="Search materials…"
                        value={materialQuery}
                        onChange={(e) => setMaterialQuery(e.target.value)}
                      />
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {materialsLoading && <p className="px-3 py-2 text-sm text-text-muted">Loading…</p>}
                      {materialError && <p className="px-3 py-2 text-sm text-danger">{materialError}</p>}
                      {!materialsLoading && !materialError && modalMaterials.length === 0 && (
                        <p className="px-3 py-2 text-sm text-text-muted">No materials found.</p>
                      )}
                      {!materialsLoading && !materialError && modalMaterials.map((m) => (
                        <button
                          key={m._id}
                          type="button"
                          onClick={() => {
                            onMaterialChange(m._id);
                            setDropdownOpen(false);
                          }}
                          className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-border/50 ${materialId === m._id ? "bg-border/30 font-medium" : ""}`}
                        >
                          <span>{m.name}</span>
                          <span className="text-xs text-text-muted">{m.currentStock} {m.unit} left · {m.category}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {initial && (
          <p className="text-sm text-text-muted">
            {transactionMaterialName(initial)} · {TYPE_LABEL[initial.type]} · material, site and type are fixed.
          </p>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Input label="Date" required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Select label="Site" required={type === "purchase" || type === "consumption"} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">{type === "purchase" || type === "consumption" ? "Select site…" : "No site"}</option>
            {sites.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} · {siteProjectName(s)}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label={`Quantity${selectedMaterial ? ` (${selectedMaterial.unit})` : ""}${type === "adjustment" ? " (+/−)" : ""}`}
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
        {type === "consumption" && (
          <Input label="Purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Slab work" />
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
