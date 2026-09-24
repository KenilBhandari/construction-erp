"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { formatDateShort, safeINR, toSafeNumber } from "@/lib/utils";
import type { SalaryDTO, SalaryStatus } from "@/types/salary";
import { salaryLabourName } from "@/types/salary";
import type { LabourDTO } from "@/types/labour";
import { SalaryDetailView } from "./salary-detail-view";
import { SalaryPaymentModal } from "./salary-payment-modal";

interface ListResponse {
  data: SalaryDTO[];
  page: number;
  limit: number;
  total: number;
}

const STATUS_TONE: Record<SalaryStatus, "neutral" | "warning" | "success"> = {
  pending: "neutral",
  "partially-paid": "warning",
  paid: "success",
};
const STATUS_LABEL: Record<SalaryStatus, string> = {
  pending: "Pending",
  "partially-paid": "Partially Paid",
  paid: "Paid",
};

export function SalaryRecordsTab() {
  const [labourId, setLabourId] = useState("");
  const [status, setStatus] = useState<string>(""); // "" = all
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [labour, setLabour] = useState<LabourDTO[]>([]);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [paying, setPaying] = useState<SalaryDTO | null>(null);

  useEffect(() => {
    fetch("/api/labour?limit=100&sort=name")
      .then(async (r) => r.json())
      .then((j) => {
        if (Array.isArray(j.data)) setLabour(j.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (labourId) params.set("labour", labourId);
    if (status) params.set("status", status);
    else params.set("status", "partially-paid,paid");
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    setLoading(true);
    fetch(`/api/salary?${params}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load salary.");
        if (!json || !Array.isArray(json.data)) throw new Error("Invalid salary response.");
        setData(json);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [labourId, status, from, to, page, reloadKey]);

  function refresh() {
    setReloadKey((k) => k + 1);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-4">
        <p className="text-sm font-medium text-text">Salary Records — read-only snapshots</p>
        <p className="mt-1 text-xs text-text-muted">Snapshot is frozen once payments begin. Adjustments appear if attendance/OT changed after payment — never silently rewritten.</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Select aria-label="Filter by worker" value={labourId} onChange={(e) => { setLabourId(e.target.value); setPage(1); }}>
            <option value="">All workers</option>
            {labour.map((l) => (<option key={l._id} value={l._id}>{l.name}</option>))}
          </Select>
          <Select aria-label="Status filter" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="partially-paid">Partially Paid</option>
            <option value="paid">Paid</option>
          </Select>
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} placeholder="From" aria-label="From date" />
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} placeholder="To" aria-label="To date" />
        </div>
        {(from || to) && <button type="button" onClick={() => { setFrom(""); setTo(""); setPage(1); }} className="mt-2 text-xs text-primary hover:underline">Clear date filter</button>}
      </Card>

      {loading && <TableSkeleton rows={6} />}
      {error && <p role="alert" className="text-sm text-danger">{error} <button type="button" className="underline" onClick={refresh}>Retry</button></p>}
      {!loading && !error && data && data.data.length === 0 && <EmptyState title="No salary records" description="Paid and partially paid settlements appear here. Use Calculate & Pending to create new settlements." />}
      {!loading && !error && data && data.data.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <THead><TR><TH>Worker / Period</TH><TH numeric>Gross</TH><TH numeric>Recovery</TH><TH numeric>Ded.</TH><TH numeric>Net</TH><TH numeric>Paid</TH><TH numeric>Remaining</TH><TH>Status</TH><TH>Actions</TH></TR></THead>
              <tbody>
                {data.data.map((s) => {
                  const remaining = toSafeNumber(s.remainingAmount ?? toSafeNumber(s.net) - toSafeNumber(s.paidAmount));
                  return (
                    <TR key={s._id}>
                      <TD><span className="font-medium">{salaryLabourName(s)}</span><p className="text-xs text-text-muted tnum">{formatDateShort(s.periodStart)} – {formatDateShort(s.periodEnd)} {s.earningsBreakdown && s.earningsBreakdown.length > 1 ? `· ${s.earningsBreakdown.length} sites` : ""}</p></TD>
                      <TD numeric>{safeINR(toSafeNumber(s.gross) + toSafeNumber(s.overtimeAmount))}</TD>
                      <TD numeric>{safeINR(s.advanceRecovery)}</TD>
                      <TD numeric>{safeINR(s.deductions)}</TD>
                      <TD numeric><span className="font-semibold">{safeINR(s.net)}</span></TD>
                      <TD numeric>{safeINR(s.paidAmount)}</TD>
                      <TD numeric><span className={remaining > 0 ? "font-semibold text-warning" : ""}>{safeINR(remaining)}</span></TD>
                      <TD><Badge tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge>{s.needsReconciliation && <span className="ml-2 text-xs font-medium text-warning">Needs review</span>}</TD>
                      <TD>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setViewing(s._id)} className="text-sm text-primary hover:underline">View</button>
                          {s.status === "partially-paid" && remaining > 0 && <button type="button" onClick={() => setPaying(s)} className="text-sm font-medium text-primary hover:underline">Pay</button>}
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </div>
          <div className="flex items-center justify-between text-sm text-text-muted">
            <p className="tnum">{data.total} record(s) · Page {data.page} of {totalPages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}
      {viewing && <SalaryDetailView salaryId={viewing} open={!!viewing} onClose={() => setViewing(null)} />}
      {paying && <SalaryPaymentModal record={paying} onClose={() => setPaying(null)} onSaved={() => { setPaying(null); refresh(); }} />}
    </div>
  );
}
