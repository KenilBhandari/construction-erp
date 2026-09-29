"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { ResponsiveDate } from "@/components/ui/responsive-date";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { safeINR } from "@/lib/utils";
import type { SalaryDTO } from "@/types/salary";
import type { AdvanceDTO } from "@/types/salary";

interface Summary {
  labour: string;
  totalGiven: number;
  totalRecovered: number;
  totalWrittenOff: number;
  outstanding: number;
}

interface WriteOffRow {
  _id: string;
  date: string;
  amount: number;
  description: string;
  notes: string | null;
  project: string | { _id: string; name: string } | null;
  site: string | { _id: string; name: string } | null;
}

interface FinanceData {
  summary: Summary | null;
  advances: AdvanceDTO[];
  writeOffs: WriteOffRow[];
  salaries: SalaryDTO[];
}

const EMPTY_FINANCE: FinanceData = { summary: null, advances: [], writeOffs: [], salaries: [] };

// Shared across the section components below so the four endpoints are
// fetched once per labourer no matter how the page orders the sections.
const financeCache = new Map<string, FinanceData>();

async function loadFinance(labourId: string): Promise<FinanceData> {
  const [sRes, wRes, aRes, salRes] = await Promise.all([
    fetch(`/api/labour/${labourId}/advance-summary`),
    fetch(`/api/labour/${labourId}/write-off`),
    fetch(`/api/advances?labour=${labourId}&limit=5`),
    fetch(`/api/salary?labour=${labourId}&limit=5`),
  ]);
  const [sJson, wJson, aJson, salJson] = await Promise.all([sRes.json(), wRes.json(), aRes.json(), salRes.json()]);
  const data: FinanceData = { ...EMPTY_FINANCE, advances: [], writeOffs: [], salaries: [] };
  try {
    if (sRes.ok && sJson && typeof sJson.outstanding === "number") data.summary = sJson;
    else if (wJson?.summary && typeof wJson.summary.outstanding === "number") data.summary = wJson.summary;
    if (wRes.ok && Array.isArray(wJson.data)) data.writeOffs = wJson.data;
    if (aRes.ok && Array.isArray(aJson.data)) data.advances = aJson.data;
    if (salRes.ok && Array.isArray(salJson.data)) data.salaries = salJson.data;
  } catch {
    // Keep whatever loaded; sections render what they have.
  }
  return data;
}

export function useLabourFinance(labourId: string) {
  const [data, setData] = useState<FinanceData>(() => financeCache.get(labourId) ?? EMPTY_FINANCE);
  const [loading, setLoading] = useState(() => !financeCache.has(labourId));

  useEffect(() => {
    if (financeCache.has(labourId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(financeCache.get(labourId) ?? EMPTY_FINANCE);
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadFinance(labourId)
      .then((d) => {
        if (cancelled) return;
        financeCache.set(labourId, d);
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [labourId]);

  return { ...data, loading };
}

function siteNameOf(r: WriteOffRow | AdvanceDTO | SalaryDTO): string {
  const raw = (r as unknown as { site?: string | { _id: string; name: string } | null }).site;
  if (!raw) return "—";
  const name = typeof raw === "string" ? raw : raw.name ?? "";
  return name.trim() ? name : "—";
}

export function LabourAdvanceSection({ labourId }: { labourId: string }) {
  const { summary, advances, loading } = useLabourFinance(labourId);

  return (
    <>
      <Card className="rounded-xl p-4 sm:rounded-lg sm:p-5">
        <h2 className="text-[15px] font-semibold tracking-tight text-text sm:text-base sm:tracking-normal">Advance Balance</h2>

        {loading ? (
          <p className="mt-3.5 text-sm text-text-muted sm:mt-3">Loading…</p>
        ) : summary ? (
          <dl className="mt-3.5 grid grid-cols-2 gap-2.5 text-sm sm:mt-4 sm:grid-cols-4 sm:gap-4">
            <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
              <dt className="text-xs text-text-muted sm:text-sm">Advance given</dt>
              <dd className="mt-0.5 truncate text-[15px] font-semibold tnum sm:mt-1 sm:text-base">{safeINR(summary.totalGiven)}</dd>
            </div>
            <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
              <dt className="text-xs text-text-muted sm:text-sm">Recovered</dt>
              <dd className="mt-0.5 truncate text-[15px] font-semibold tnum sm:mt-1 sm:text-base">{safeINR(summary.totalRecovered)}</dd>
            </div>
            <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
              <dt className="text-xs text-text-muted sm:text-sm">Written off</dt>
              <dd className="mt-0.5 truncate text-[15px] font-semibold tnum sm:mt-1 sm:text-base">{safeINR(summary.totalWrittenOff)}</dd>
            </div>
            <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
              <dt className="text-xs text-text-muted sm:text-sm">Outstanding</dt>
              <dd className="mt-0.5 truncate text-[15px] font-semibold tnum sm:mt-1 sm:text-base">{safeINR(summary.outstanding)}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3.5 text-sm text-text-muted sm:mt-3">No advance data.</p>
        )}
      </Card>

      {advances.length > 0 && (
        <Card className="rounded-xl p-4 sm:rounded-lg sm:p-5">
          <h3 className="text-[15px] font-semibold tracking-tight text-text sm:text-base sm:tracking-normal">Recent advances</h3>
          <div className="scroll-area mt-3.5 overflow-x-auto sm:mt-3">
            <Table>
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH numeric>Amount</TH>
                  <TH>Site</TH>
                  <TH className="hidden sm:table-cell">Payment</TH>
                  <TH className="hidden sm:table-cell">Reference</TH>
                  <TH>Notes</TH>
                </TR>
              </THead>
              <tbody>
                {advances.map((a) => {
                  const siteLabel = siteNameOf(a);
                  const isUnspecifiedSite = siteLabel === "—";
                  const reasonNotes = [a.reason, a.notes].filter(Boolean).join(" — ") || "—";
                  const isUnspecifiedReason = reasonNotes === "—";
                  return (
                    <TR key={a._id}>
                      <TD className="tnum"><ResponsiveDate date={a.date} /></TD>
                      <TD numeric>{safeINR(a.amount)}</TD>
                      <TD className={isUnspecifiedSite ? "text-text-muted italic" : ""}>{siteLabel}</TD>
                      <TD className={`hidden sm:table-cell ${a.paymentMethod ? "" : "text-text-muted italic"}`}>{a.paymentMethod ?? "—"}</TD>
                      <TD className={`hidden sm:table-cell ${a.reference ? "tnum" : "tnum text-text-muted italic"}`}>{a.reference ?? "—"}</TD>
                      <TD className={`max-w-[200px] truncate ${isUnspecifiedReason ? "text-text-muted italic" : ""}`}>
                        <span title={reasonNotes}>{reasonNotes}</span>
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </Card>
      )}
    </>
  );
}

export function LabourSalaryRecordsSection({ labourId }: { labourId: string }) {
  const { salaries } = useLabourFinance(labourId);
  if (salaries.length === 0) return null;

  return (
    <Card className="rounded-xl p-4 sm:rounded-lg sm:p-5">
      <h3 className="text-[15px] font-semibold tracking-tight text-text sm:text-base sm:tracking-normal">Recent Salary records</h3>
      <div className="scroll-area mt-3.5 overflow-x-auto sm:mt-3">
        <Table>
          <THead>
            <TR>
              <TH>Period</TH>
              <TH numeric>Net</TH>
              <TH numeric>Recovery</TH>
              <TH numeric>Paid</TH>
            </TR>
          </THead>
          <tbody>
            {salaries.map((s) => (
              <TR key={s._id}>
                <TD className="tnum">
                  <span className="sm:hidden">
                    <ResponsiveDate date={s.periodStart} />
                    <span className="block text-xs text-text-muted">
                      <ResponsiveDate date={s.periodEnd} />
                    </span>
                  </span>
                  <span className="hidden whitespace-nowrap sm:inline">
                    <ResponsiveDate date={s.periodStart} /> – <ResponsiveDate date={s.periodEnd} />
                  </span>
                </TD>
                <TD numeric className="font-semibold">{safeINR(s.net)}</TD>
                <TD numeric>{safeINR(s.advanceRecovery)}</TD>
                <TD numeric>{safeINR(s.paidAmount)}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </div>
    </Card>
  );
}

export function LabourWriteOffsSection({ labourId }: { labourId: string }) {
  const { writeOffs } = useLabourFinance(labourId);
  if (writeOffs.length === 0) return null;

  return (
    <Card className="rounded-xl p-4 sm:rounded-lg sm:p-5">
      <h3 className="text-[15px] font-semibold tracking-tight text-text sm:text-base sm:tracking-normal">Recent write-offs</h3>
      <div className="scroll-area mt-3.5 overflow-x-auto sm:mt-3">
        <Table>
          <THead>
            <TR>
              <TH>Date</TH>
              <TH numeric>Amount</TH>
              <TH>Description</TH>
              <TH>Site</TH>
            </TR>
          </THead>
          <tbody>
            {writeOffs.slice(0, 5).map((r) => {
              const siteLabel = siteNameOf(r);
              const isUnspec = siteLabel === "—";
              return (
                <TR key={r._id}>
                  <TD className="tnum"><ResponsiveDate date={r.date} /></TD>
                  <TD numeric>{safeINR(r.amount)}</TD>
                  <TD>{r.description}</TD>
                  <TD className={isUnspec ? "text-text-muted italic" : ""}>{siteLabel}</TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      </div>
    </Card>
  );
}
