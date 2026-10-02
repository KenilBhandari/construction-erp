"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatINR, formatCompactINR, formatDateShort } from "@/lib/utils";
import { useDashboardSummary } from "@/context/CacheContext";
import type { DashboardSummary } from "@/lib/dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { statusLabel, statusTone } from "@/components/projects/project-status";
import type { ProjectStatus } from "@/types/project";

/** Relative day label — Today / Yesterday / 25 Sept. */
function dayLabel(d: Date): string {
  const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const diff = Math.round((today - day) / 86400000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  return formatDateShort(d);
}

/**
 * "How is my construction business doing today?" — every figure derived
 * from underlying records (see src/lib/dashboard.ts).
 *
 * Client-rendered over GET /api/dashboard/summary with a
 * mutation-driven memory cache (see src/lib/dashboard-cache.ts): repeat
 * visits with no intervening mutation serve cache with zero network.
 */
export default function DashboardPage() {
  // Summary arrives revived (real Dates) from useDashboardSummary, so the
  // JSX below is unchanged from the former server component.
  const { data: s, loading, error, refresh } = useDashboardSummary();

  if (loading) {
    return (
      <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
        <PageHeader
          title="Dashboard"
          description="How is the construction business doing today?"
        />
        <TableSkeleton rows={8} />
      </div>
    );
  }

  if (error || !s) {
    return (
      <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
        <PageHeader
          title="Dashboard"
          description="How is the construction business doing today?"
        />
        <p role="alert" className="text-sm text-danger">
          {error ?? "Failed to load dashboard."}{" "}
          <Button type="button" variant="outline" size="sm" onClick={refresh}>
            Retry
          </Button>
        </p>
      </div>
    );
  }

  return <DashboardView s={s} />;
}

function DashboardView({ s }: { s: DashboardSummary }) {

  const contracted = s.contractsTotal;
  const receivedPct =
    contracted > 0 ? Math.round((s.receivedTotal / contracted) * 100) : 0;

  // Note: low stock is NOT repeated here — it has its own card below.
  const attention: { text: string; href: string }[] = [];
  if (s.outstandingTotal > 0) {
    attention.push({ text: `${formatINR(s.outstandingTotal)} client payments pending`, href: "/dashboard/payments" });
  }
  if (s.pendingLabourPayments > 0) {
    attention.push({ text: `${formatINR(s.pendingLabourPayments)} salary pending`, href: "/dashboard/salary" });
  }
  if (s.unmarkedToday > 0) {
    attention.push({ text: `${s.unmarkedToday} worker(s) unmarked today`, href: "/dashboard/attendance" });
  }

  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
      <PageHeader
        title="Dashboard"
        description="How is the construction business doing today?"
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Active Projects" value={String(s.activeProjects)} hint={`${s.activeSites} active sites`} />
        <StatCard
          label="Today's Labour"
          value={s.activeLabour > 0 ? `${s.today.present} / ${s.activeLabour}` : "—"}
          hint="present / active"
        />
        <StatCard
          label="Client Payments"
          value={formatCompactINR(s.outstandingTotal)}
          hint={`pending · ${formatCompactINR(s.receivedTotal)} received`}
        />
        <StatCard
          label="Estimated Project Margin"
          value={formatCompactINR(s.profitTotal)}
          hint={`${formatCompactINR(s.contractsTotal)} contract − ${formatCompactINR(s.recordedCostsTotal)} costs`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-4 lg:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold text-text sm:text-base">Today&apos;s Operations</h2>
            {s.today.total > 0 && (
              <Link href="/dashboard/attendance" className="inline-flex shrink-0 items-center gap-1 py-1 text-[13px] font-medium text-primary hover:underline sm:text-sm">
                View <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
          {s.today.total === 0 ? (
            <p className="mt-2 text-sm leading-6 text-text-muted">
              No attendance marked today yet.{" "}
              <Link href="/dashboard/attendance" className="inline-flex items-center gap-1 py-1 text-primary hover:underline">
                Mark attendance <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </p>
          ) : (
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 sm:mt-3 sm:grid-cols-4 sm:gap-3">
              <div className="min-w-0">
                <dt className="text-xs text-text-muted sm:text-[13px]">Present</dt>
                <dd className="mt-0.5 text-[15px] font-semibold tnum sm:text-base">{s.today.present}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-text-muted sm:text-[13px]">Absent</dt>
                <dd className="mt-0.5 text-[15px] font-semibold tnum sm:text-base">{s.today.absent}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-text-muted sm:text-[13px]">Half / Leave</dt>
                <dd className="mt-0.5 text-[15px] font-semibold tnum sm:text-base">{s.today.half + s.today.leave}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-text-muted sm:text-[13px]">OT hours</dt>
                <dd className="mt-0.5 text-[15px] font-semibold tnum sm:text-base">{s.today.overtimeHours}</dd>
              </div>
            </dl>
          )}
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold text-text sm:text-base">Needs Attention</h2>
            {attention.length > 0 && <Badge tone="warning">{attention.length}</Badge>}
          </div>
          {attention.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">All clear — nothing needs attention.</p>
          ) : (
            <ul className="scroll-area mt-2 max-h-[168px] divide-y divide-border sm:max-h-[208px]">
              {attention.map((a) => (
                <li key={a.text} className="py-2 text-sm leading-6">
                  <Link href={a.href} className="inline-flex items-center gap-1.5 text-text hover:text-primary hover:underline">
                    <span className="min-w-0">{a.text}</span> <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-text sm:text-base">Low Stock</h2>
          {s.lowStockCount > 0 && <Badge tone="warning">{s.lowStockCount} item(s)</Badge>}
        </div>
        {s.lowStock.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">Every material is above minimum.</p>
        ) : (
          <ul className="scroll-area mt-2 max-h-[168px] divide-y divide-border sm:max-h-[208px]">
            {s.lowStock.map((m) => (
              <li key={m._id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate font-medium text-text">{m.name}</span>
                <span className="shrink-0 text-[13px] tnum text-text-muted">
                  {m.currentStock} / min {m.minimumStock} {m.unit}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/dashboard/stock" className="mt-2 inline-block py-1 text-sm text-primary hover:underline">
          Open stock
        </Link>
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-text sm:text-base">Project Overview</h2>
          <Link href="/dashboard/projects" className="inline-flex shrink-0 items-center gap-1 py-1 text-[13px] font-medium text-primary hover:underline sm:text-sm">
            All <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {s.projects.length === 0 ? (
          <div className="mt-2">
            <EmptyState
              title="No active projects"
              description="Create your first project to start tracking sites, labour, expenses and payments."
              action={
                <Link href="/dashboard/projects/new" className="text-sm text-primary hover:underline">
                  Create Project
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="scroll-area mt-2 max-h-[312px] divide-y divide-border sm:max-h-[384px]">
            {s.projects.map((p) => {
              return (
                <li key={p._id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/dashboard/projects/${p._id}`} className="min-w-0 truncate py-0.5 text-[15px] font-medium text-primary hover:underline sm:text-base">
                      {p.name}
                    </Link>
                    <Badge tone={statusTone(p.status as ProjectStatus)} className="shrink-0">{statusLabel(p.status as ProjectStatus)}</Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-2.5">
                    <ProgressBar value={p.progress} className="min-w-0 flex-1" />
                    <span className="shrink-0 text-xs tnum text-text-muted">
                      {formatCompactINR(p.expense)} / {formatCompactINR(p.budget)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:gap-4 lg:grid-cols-3">
        <Card className="p-4 sm:p-5">
          <h2 className="text-[15px] font-semibold text-text sm:text-base">Client Payments</h2>
          <dl className="mt-3 flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-muted">Received</dt>
              <dd className="font-medium tnum">{formatINR(s.receivedTotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">Pending</dt>
              <dd className="font-medium tnum">{formatINR(s.outstandingTotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">Total contracted</dt>
              <dd className="font-medium tnum">{formatINR(contracted)}</dd>
            </div>
          </dl>
          <div className="mt-3 flex justify-between gap-2 text-sm">
            <span className="text-text-muted">Received vs pending</span>
            <span className="shrink-0 tnum">{receivedPct}% received</span>
          </div>
          <ProgressBar value={receivedPct} className="mt-2" />
        </Card>

        <Card className="p-4 sm:p-5">
          <h2 className="text-[15px] font-semibold text-text sm:text-base">Today&apos;s Spending</h2>
          <dl className="mt-3 flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-muted">Purchases</dt>
              <dd className="font-medium tnum">{formatINR(s.todayPurchases)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">Expenses</dt>
              <dd className="font-medium tnum">{formatINR(s.todayExpenses)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-1.5">
              <dt className="font-medium">Total</dt>
              <dd className="font-semibold tnum">{formatINR(s.todayPurchases + s.todayExpenses)}</dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {s.todayPurchases > 0 && (
              <Link href="/dashboard/purchases" className="inline-flex items-center gap-1 py-1 text-primary hover:underline">
                View purchases <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
            {s.todayExpenses > 0 && (
              <Link href="/dashboard/expenses" className="inline-flex items-center gap-1 py-1 text-primary hover:underline">
                View expenses <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
            {s.todayPurchases === 0 && s.todayExpenses === 0 && (
              <span className="text-text-muted">Nothing recorded today.</span>
            )}
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <h2 className="text-[15px] font-semibold text-text sm:text-base">Labour Cost</h2>
          <dl className="mt-3 flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-muted">Assigned to sites</dt>
              <dd className="font-medium tnum">{formatINR(s.labourCostAssigned)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">Unassigned</dt>
              <dd className="font-medium tnum">{formatINR(s.labourCostUnassigned)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">Overtime</dt>
              <dd className="font-medium tnum">{formatINR(s.labourCostOvertime)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-1.5">
              <dt className="font-medium">Total</dt>
              <dd className="font-semibold tnum">{formatINR(s.labourCostTotal)}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-4 lg:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-[15px] font-semibold text-text sm:text-base">Monthly Expenses</h2>
            <Link href="/dashboard/reports" className="inline-flex shrink-0 items-center gap-1 py-1 text-[13px] font-medium text-primary hover:underline sm:text-sm">
              Reports <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ul className="scroll-area mt-2 max-h-[248px] divide-y divide-border">
            {[...s.monthlyExpenses].reverse().map((m, i) => (
              <li key={m.month} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className={i === 0 ? "font-medium text-text" : "text-text-muted"}>{m.month}</span>
                <span className={`shrink-0 tnum ${i === 0 ? "font-semibold text-text" : "text-text"}`}>
                  {formatINR(m.amount)}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-4 sm:p-5">
          <h2 className="text-[15px] font-semibold text-text sm:text-base">Recent Activity</h2>
          {s.recentActivity.length === 0 ? (
            <p className="mt-2 text-sm leading-6 text-text-muted">
              Activity appears here once attendance, purchases, expenses and payments are recorded.
            </p>
          ) : (
            <ul className="scroll-area mt-2 flex max-h-[240px] flex-col gap-2 sm:mt-3 sm:max-h-[320px] sm:gap-2.5">
              {s.recentActivity.map((a, i) => {
                const sameDay =
                  a.eventDate &&
                  a.eventDate.toISOString().slice(0, 10) === a.at.toISOString().slice(0, 10);
                return (
                  <li key={i} className={`text-sm leading-6 text-text ${i >= 5 ? "hidden sm:list-item" : ""}`}>
                    <span className="text-text-muted tnum">{dayLabel(a.at)}</span> — {a.text}
                    {a.eventDate && !sameDay && (
                      <span className="text-text-muted"> · for {formatDateShort(a.eventDate)}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

    </div>
  );
}
