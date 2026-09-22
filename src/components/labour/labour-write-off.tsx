"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { formatDateShort, formatINR, toDateInputValue } from "@/lib/utils";
import type { SiteDTO } from "@/types/site";
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
  const [sites, setSites] = useState<SiteDTO[]>([]);

  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => toDateInputValue());
  const [site, setSite] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

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
      // keep existing state, avoid variable error on partial failure
      setAdvances((prev) => prev ?? []);
      setSalaries((prev) => prev ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    fetch("/api/sites?limit=100")
      .then(async (r) => r.json())
      .then((j) => {
        if (Array.isArray(j.data)) setSites(j.data);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labourId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = amount === "" ? 0 : Number(amount);
    if (Number.isNaN(amt) || amt < 1) {
      setError("Amount must be at least ₹1.");
      return;
    }
    if (summary && amt > summary.outstanding) {
      setError(`Write-off ₹${amt.toLocaleString("en-IN")} exceeds outstanding ${formatINR(summary.outstanding)}.`);
      return;
    }
    setPending(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch(`/api/labour/${labourId}/write-off`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          date: date || undefined,
          site: site || null,
          description: description.trim() || undefined,
          notes: notes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Write-off failed.");
      setOkMsg(`Write-off ${formatINR(amt)} recorded. Outstanding now ${formatINR(json.summary?.outstanding ?? 0)}.`);
      setAmount("");
      setDescription("");
      setNotes("");
      if (json.summary) setSummary(json.summary);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  function projectNameOf(r: WriteOffRow | AdvanceDTO | SalaryDTO): string {
    const raw = (r as unknown as { project?: string | { _id: string; name: string } | null }).project;
    if (!raw) return "";
    return typeof raw === "string" ? raw : raw.name ?? "";
  }
  function siteNameOf(r: WriteOffRow | AdvanceDTO | SalaryDTO): string {
    const raw = (r as unknown as { site?: string | { _id: string; name: string } | null }).site;
    if (!raw) return "";
    return typeof raw === "string" ? raw : raw.name ?? "";
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <h2 className="text-base font-semibold text-text">Advance Balance</h2>
        <p className="mt-1 text-sm text-text-muted">
          Advance given = recoverable outstanding (not an expense). Outstanding = given −
          recovered (salary) − written off. Uses the single source of truth — no duplicate
          calculation in the UI.
        </p>

        {loading ? (
          <p className="mt-3 text-sm text-text-muted">Loading…</p>
        ) : summary ? (
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-text-muted">Advance given</dt>
              <dd className="mt-0.5 font-semibold tnum">{formatINR(summary.totalGiven)}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Recovered (salary)</dt>
              <dd className="mt-0.5 font-semibold tnum">{formatINR(summary.totalRecovered)}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Written off (expense)</dt>
              <dd className="mt-0.5 font-semibold tnum">{formatINR(summary.totalWrittenOff)}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Outstanding</dt>
              <dd className="mt-0.5 font-semibold tnum">{formatINR(summary.outstanding)}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-text-muted">No advance data.</p>
        )}
        <p className="mt-2 text-xs text-text-muted">
          Outstanding belongs to the labour, not a site — site/project on transactions is attribution only.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
          <h3 className="text-sm font-medium text-text">Write off outstanding</h3>
          <p className="text-xs text-text-muted">
            Converts unrecoverable outstanding into a single Expense (category
            LABOUR_ADVANCE_WRITE_OFF). Does not change original advances or salary recoveries.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              label="Amount (₹)"
              type="number"
              min={1}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={summary ? `max ${summary.outstanding}` : "1000"}
            />
            <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Select label="Site (attribution)" value={site} onChange={(e) => setSite(e.target.value)}>
              <option value="">No site — GENERAL</option>
              {sites.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <Input
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Advance unrecoverable — worker left"
            maxLength={300}
          />
          <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional reason…" />
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          {okMsg && <p role="status" className="text-sm text-success">{okMsg}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={pending || (summary ? summary.outstanding <= 0 : false)}>
              {pending ? "Saving…" : "Write off"}
            </Button>
          </div>
          {summary && summary.outstanding <= 0 && (
            <p className="text-xs text-text-muted">No outstanding to write off.</p>
          )}
        </form>
      </Card>

      {/* Advance transaction history */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text">Advance history</h3>
          <Link href={`/dashboard/salary?tab=advances&labour=${labourId}`} className="text-xs text-primary hover:underline">
            View all advances
          </Link>
        </div>
        {advances.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">No advances recorded.</p>
        ) : (
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
                  const siteLabel = siteNameOf(a) || "—";
                  const projLabel = projectNameOf(a);
                  const siteProject = projLabel ? `${siteLabel} · ${projLabel}` : siteLabel;
                  const reasonNotes = [a.reason, a.notes].filter(Boolean).join(" — ") || "—";
                  return (
                    <TR key={a._id}>
                      <TD className="tnum">{formatDateShort(a.date)}</TD>
                      <TD numeric>{formatINR(a.amount)}</TD>
                      <TD>{siteProject}</TD>
                      <TD>{a.paymentMethod ?? "—"}</TD>
                      <TD className="tnum">{a.reference ?? "—"}</TD>
                      <TD className="max-w-[200px] truncate">
                        <span title={reasonNotes}>{reasonNotes}</span>
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
      </Card>

      {/* Write-off history */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-text">Write-off history</h3>
        {writeOffs.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">No write-offs yet — write-offs appear as a single Expense.</p>
        ) : (
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
                {writeOffs.slice(0, 5).map((r) => (
                  <TR key={r._id}>
                    <TD className="tnum">{formatDateShort(r.date)}</TD>
                    <TD numeric>{formatINR(r.amount)}</TD>
                    <TD>{r.description}</TD>
                    <TD>
                      {(siteNameOf(r) || "—")} · {(projectNameOf(r) || "GENERAL")}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>

      {/* Salary recovery history */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text">Salary recovery history</h3>
          <Link href={`/dashboard/salary?labour=${labourId}`} className="text-xs text-primary hover:underline">
            View all salary
          </Link>
        </div>
        {salaries.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">No salary settlements yet.</p>
        ) : (
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
                    <TD numeric>{formatINR(s.gross + s.overtimeAmount)}</TD>
                    <TD numeric>{formatINR(s.advanceRecovery)}</TD>
                    <TD numeric>{formatINR(s.net)}</TD>
                    <TD numeric>{formatINR(s.paidAmount)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </div>
        )}
        <p className="mt-2 text-xs text-text-muted">
          Recovery = amount intentionally recovered from this salary (0 allowed). Advance itself is money previously given.
        </p>
      </Card>
    </div>
  );
}
