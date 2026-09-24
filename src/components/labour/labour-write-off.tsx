"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { formatDateShort, safeINR, toSafeNumber } from "@/lib/utils";
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

export function LabourWriteOffSection({ labourId }: { labourId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [writeOffs, setWriteOffs] = useState<WriteOffRow[]>([]);
  const [advances, setAdvances] = useState<AdvanceDTO[]>([]);
  const [salaries, setSalaries] = useState<SalaryDTO[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [sRes, wRes, aRes, salRes] = await Promise.all([
        fetch(`/api/labour/${labourId}/advance-summary`),
        fetch(`/api/labour/${labourId}/write-off`),
        fetch(`/api/advances?labour=${labourId}&limit=5`),
        fetch(`/api/salary?labour=${labourId}&limit=5`),
      ]);
      const [sJson, wJson, aJson, salJson] = await Promise.all([sRes.json(), wRes.json(), aRes.json(), salRes.json()]);
      if (sRes.ok && sJson && typeof sJson.outstanding === "number") setSummary(sJson);
      else if (wJson?.summary && typeof wJson.summary.outstanding === "number") setSummary(wJson.summary);
      if (wRes.ok && Array.isArray(wJson.data)) setWriteOffs(wJson.data);
      else if (wRes.ok) setWriteOffs([]);
      if (aRes.ok && Array.isArray(aJson.data)) setAdvances(aJson.data);
      else setAdvances([]);
      if (salRes.ok && Array.isArray(salJson.data)) setSalaries(salJson.data);
      else setSalaries([]);
    } catch {
      setAdvances((prev) => prev ?? []);
      setSalaries((prev) => prev ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labourId]);

  function projectNameOf(r: WriteOffRow | AdvanceDTO | SalaryDTO): string {
    const raw = (r as unknown as { project?: string | { _id: string; name: string } | null }).project;
    if (!raw) return "—";
    const name = typeof raw === "string" ? raw : raw.name ?? "";
    return name.trim() ? name : "—";
  }
  function siteNameOf(r: WriteOffRow | AdvanceDTO | SalaryDTO): string {
    const raw = (r as unknown as { site?: string | { _id: string; name: string } | null }).site;
    if (!raw) return "—";
    const name = typeof raw === "string" ? raw : raw.name ?? "";
    return name.trim() ? name : "—";
  }
  function formatSiteProject(siteLabel: string, projLabel: string): string {
    const hasSite = siteLabel !== "—";
    const hasProj = projLabel !== "—";
    if (hasSite && hasProj) return `${siteLabel} / ${projLabel}`;
    if (hasSite) return siteLabel;
    if (hasProj) return projLabel;
    return "—";
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <h2 className="text-base font-semibold text-text">Advance Balance</h2>

        {loading ? (
          <p className="mt-3 text-sm text-text-muted">Loading…</p>
        ) : summary ? (
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-text-muted">Advance given</dt>
              <dd className="mt-0.5 font-semibold tnum">{safeINR(summary.totalGiven)}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Recovered</dt>
              <dd className="mt-0.5 font-semibold tnum">{safeINR(summary.totalRecovered)}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Written off</dt>
              <dd className="mt-0.5 font-semibold tnum">{safeINR(summary.totalWrittenOff)}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Outstanding</dt>
              <dd className="mt-0.5 font-semibold tnum">{safeINR(summary.outstanding)}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-text-muted">No advance data.</p>
        )}
      </Card>

      {advances.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-text">Recent advances</h3>
          <div className="mt-2 overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH numeric>Amount</TH>
                  <TH>Site / Project</TH>
                  <TH>Payment</TH>
                  <TH>Reference</TH>
                  <TH>Reason / Notes</TH>
                </TR>
              </THead>
              <tbody>
                {advances.map((a) => {
                  const siteLabel = siteNameOf(a);
                  const projLabel = projectNameOf(a);
                  const siteProject = formatSiteProject(siteLabel, projLabel);
                  const isUnspecifiedSiteProject = siteProject === "—";
                  const reasonNotes = [a.reason, a.notes].filter(Boolean).join(" — ") || "—";
                  const isUnspecifiedReason = reasonNotes === "—";
                  return (
                    <TR key={a._id}>
                      <TD className="tnum">{formatDateShort(a.date)}</TD>
                      <TD numeric>{safeINR(a.amount)}</TD>
                      <TD className={isUnspecifiedSiteProject ? "text-text-muted italic" : ""}>{siteProject}</TD>
                      <TD className={a.paymentMethod ? "" : "text-text-muted italic"}>{a.paymentMethod ?? "—"}</TD>
                      <TD className={a.reference ? "tnum" : "tnum text-text-muted italic"}>{a.reference ?? "—"}</TD>
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

      {writeOffs.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-text">Recent write-offs</h3>
          <div className="mt-2 overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH numeric>Amount</TH>
                  <TH>Description</TH>
                  <TH>Site / Project</TH>
                </TR>
              </THead>
              <tbody>
                {writeOffs.slice(0, 5).map((r) => {
                  const sp = formatSiteProject(siteNameOf(r), projectNameOf(r));
                  const isUnspec = sp === "—";
                  return (
                    <TR key={r._id}>
                      <TD className="tnum">{formatDateShort(r.date)}</TD>
                      <TD numeric>{safeINR(r.amount)}</TD>
                      <TD>{r.description}</TD>
                      <TD className={isUnspec ? "text-text-muted italic" : ""}>{sp}</TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </Card>
      )}

      {salaries.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-text">Recent Salary records</h3>
          <div className="mt-2 overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Period</TH>
                  <TH numeric>Gross + OT</TH>
                  <TH numeric>Recovery</TH>
                  <TH numeric>Net</TH>
                  <TH numeric>Paid</TH>
                </TR>
              </THead>
              <tbody>
                {salaries.map((s) => (
                  <TR key={s._id}>
                    <TD className="tnum">
                      {formatDateShort(s.periodStart)} – {formatDateShort(s.periodEnd)}
                    </TD>
                    <TD numeric>{safeINR(toSafeNumber(s.gross) + toSafeNumber(s.overtimeAmount))}</TD>
                    <TD numeric>{safeINR(s.advanceRecovery)}</TD>
                    <TD numeric>{safeINR(s.net)}</TD>
                    <TD numeric>{safeINR(s.paidAmount)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
