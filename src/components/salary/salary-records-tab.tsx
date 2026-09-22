"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { formatDateShort, formatINR } from "@/lib/utils";
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
  const [status, setStatus] = useState<string>(""); // "" = all (partially+paid), else specific
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
  }, [labourId, status, page, reloadKey]);

  function refresh() {
    setLoading(true);
    setReloadKey((k) => k + 1);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-4">
        <p className="text-sm text-text-muted">Historical settlements — snapshot is frozen once payments begin. View details for full breakdown and payments.</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <Select aria-label="Filter by worker" value={labourId} onChange={(e) => { setLabourId(e.target.value); setPage(1); }}>
              <option value="">All workers</option>
              {labour.map((l) => (<option key={l._id} value={l._id}>{l.name}</option>))}
            </Select>
          </div>
          <Select aria-label="Status filter" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All (Partially Paid + Paid)</option>
            <option value="partially-paid">Partially Paid</option>
            <option value="paid">Paid</option>
          </Select>
        </div>
      </Card>

      {loading && <TableSkeleton rows={6} />}
      {error && <p role="alert" className="text-sm text-danger">{error} <button type="button" className="underline" onClick={refresh}>Retry</button></p>}
      {!loading && !error && data && data.data.length === 0 && <EmptyState title="No salary records" description="Paid and partially paid settlements appear here." />}
      {!loading && !error && data && data.data.length > 0 && (
        <>
          <Table>
            <THead><TR><TH>Worker / Period</TH><TH numeric>Gross</TH><TH numeric>Recovery</TH><TH numeric>Ded.</TH><TH numeric>Net</TH><TH numeric>Paid</TH><TH numeric>Remaining</TH><TH>Status</TH><TH>Actions</TH></TR></THead>
            <tbody>
              {data.data.map((s) => {
                const remaining = s.remainingAmount ?? s.net - s.paidAmount;
                return (
                  <TR key={s._id}>
                    <TD><span className="font-medium">{salaryLabourName(s)}</span><p className="text-xs text-text-muted tnum">{formatDateShort(s.periodStart)} – {formatDateShort(s.periodEnd)}</p></TD>
                    <TD numeric>{formatINR(s.gross + s.overtimeAmount)}</TD>
                    <TD numeric>{formatINR(s.advanceRecovery)}</TD>
                    <TD numeric>{formatINR(s.deductions)}</TD>
                    <TD numeric>{formatINR(s.net)}</TD>
                    <TD numeric>{formatINR(s.paidAmount)}</TD>
                    <TD numeric>{formatINR(remaining)}</TD>
                    <TD><Badge tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge></TD>
                    <TD>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setViewing(s._id)} className="text-sm text-text-muted hover:underline">View</button>
                        {s.status === "partially-paid" && <button type="button" onClick={() => setPaying(s)} className="text-sm text-primary hover:underline">Record Payment</button>}
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
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
