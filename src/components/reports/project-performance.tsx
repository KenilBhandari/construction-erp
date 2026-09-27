"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/utils";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import type { ProjectPerformanceRow } from "@/lib/reports";
import type { ProjectFinance } from "@/types/finance";

interface SiteSplit {
  _id: string;
  name: string;
  labourCost: number;
  materialCost: number;
  manualExpenses: number;
  totalCost: number;
}

function scopeQuery(scope: { from: string; to: string }): string {
  const params = new URLSearchParams();
  if (scope.from) params.set("from", scope.from);
  if (scope.to) params.set("to", scope.to);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** Project Performance table — canonical numbers, expandable cost-head drill-down. */
export function ProjectPerformance({
  rows,
  general,
  scope,
}: {
  rows: ProjectPerformanceRow[];
  general: { materialPurchases: number; labourCost: number; manualExpenses: number; total: number };
  scope: { from: string; to: string };
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ finance: ProjectFinance; sites: SiteSplit[] } | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle(id: string) {
    if (openId === id) {
      setOpenId(null);
      setDetail(null);
      return;
    }
    setOpenId(id);
    setDetail(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/project-detail?project=${id}${scopeQuery(scope).replace("?", "&")}`);
      const j = await res.json();
      if (j?.finance) setDetail(j);
    } catch {
      /* detail stays empty */
    } finally {
      setLoading(false);
    }
  }

  if (rows.length === 0) {
    return <p className="text-sm text-text-muted">No projects yet.</p>;
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>Project</TH>
          <TH numeric>Contract</TH>
          <TH numeric>Cost</TH>
          <TH numeric>Profit</TH>
          <TH numeric>Margin</TH>
          <TH numeric>Received</TH>
          <TH numeric>Pending</TH>
        </TR>
      </THead>
      <tbody>
        {rows.map((p) => (
          <Fragment key={p._id}>
            <TR onClick={() => toggle(p._id)} className="cursor-pointer">
              <TD>
                <span className="font-medium text-primary">{p.name}</span>
                <p className="text-xs text-text-muted">
                  {p.clientName} · {p.status}
                </p>
              </TD>
              <TD numeric>{formatINR(p.contractValue)}</TD>
              <TD numeric>{formatINR(p.totalExpense)}</TD>
              <TD numeric>{formatINR(p.profit)}</TD>
              <TD numeric>{p.margin.toFixed(1)}%</TD>
              <TD numeric>{formatINR(p.received)}</TD>
              <TD numeric>{formatINR(p.pending)}</TD>
            </TR>
            {openId === p._id && (
              <tr key={`${p._id}-detail`} className="bg-background/50">
                <td colSpan={7} className="px-4 py-3">
                  {loading || !detail ? (
                    <p className="text-xs text-text-muted">{loading ? "Loading breakdown…" : "Could not load breakdown."}</p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div>
                          <p className="text-xs text-text-muted">Materials</p>
                          <p className="text-sm font-medium tnum">{formatINR(detail.finance.materialExpense)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-text-muted">
                            Labour · {detail.finance.labourBreakdown.presentDays}P / {detail.finance.labourBreakdown.halfDays}H
                          </p>
                          <p className="text-sm font-medium tnum">{formatINR(detail.finance.labourExpense)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-text-muted">Manual expenses</p>
                          <p className="text-sm font-medium tnum">{formatINR(detail.finance.manualExpenses)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-text-muted">Budget remaining</p>
                          <p className="text-sm font-medium tnum">{formatINR(p.budget - detail.finance.totalExpense)}</p>
                        </div>
                      </div>
                      {detail.sites.length > 0 && (
                        <div>
                          <p className="text-xs text-text-muted">Site split</p>
                          <ul className="mt-1 divide-y divide-border">
                            {detail.sites.map((s) => (
                              <li key={s._id} className="flex items-center justify-between py-1 text-sm">
                                <span>{s.name}</span>
                                <span className="tnum">{formatINR(s.totalCost)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <Link
                        href={`/dashboard/projects/${p._id}`}
                        className="text-xs font-medium text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Open project →
                      </Link>
                    </div>
                  )}
                </td>
              </tr>
            )}
          </Fragment>
        ))}
        {general.total > 0 && (
          <TR key="general">
            <TD>
              <span className="font-medium">General</span>
              <p className="text-xs text-text-muted">Unassigned costs · not in any project above</p>
            </TD>
            <TD numeric>—</TD>
            <TD numeric>{formatINR(general.total)}</TD>
            <TD numeric>—</TD>
            <TD numeric>—</TD>
            <TD numeric>—</TD>
            <TD numeric>—</TD>
          </TR>
        )}
      </tbody>
    </Table>
  );
}
