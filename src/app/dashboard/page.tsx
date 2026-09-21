import Link from "next/link";
import { connectDB } from "@/lib/mongodb";
import { formatINR } from "@/lib/utils";
import { getDashboardSummary } from "@/lib/dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { statusLabel, statusTone } from "@/components/projects/project-status";
import type { ProjectStatus } from "@/types/project";

/**
 * "How is my construction business doing today?" — every figure derived
 * from underlying records (see src/lib/dashboard.ts).
 */
export default async function DashboardPage() {
  await connectDB();
  const s = await getDashboardSummary();

  const maxMonth = Math.max(1, ...s.monthlyExpenses.map((m) => m.amount));
  const receivedTotal = s.receivedTotal + s.outstandingTotal;
  const receivedPct =
    receivedTotal > 0 ? Math.round((s.receivedTotal / receivedTotal) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="How is the construction business doing today?"
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active Projects" value={String(s.activeProjects)} hint={`${s.activeSites} active sites`} />
        <StatCard label="Today's Labour" value={s.today.total > 0 ? `${s.today.present} / ${s.today.total}` : "—"} hint={s.today.total > 0 ? "present / marked" : "No attendance today"} />
        <StatCard label="Monthly Expenses" value={formatINR(s.monthExpenses)} hint="Purchases + expenses" />
        <StatCard label="Pending Client Payment" value={formatINR(s.outstandingTotal)} hint={`Received ${formatINR(s.receivedTotal)}`} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Labour" value={String(s.totalLabour)} hint={`${s.activeLabour} active`} />
        <StatCard label="Pending Salary" value={formatINR(s.pendingLabourPayments)} hint="Net − paid" />
        <StatCard label="Today's Purchases" value={formatINR(s.todayPurchases)} hint={`Expenses ${formatINR(s.todayExpenses)}`} />
        <StatCard label="Est. Profit (all projects)" value={formatINR(s.profitTotal)} hint="Contract − all costs" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-base font-semibold text-text">Today&apos;s Overview</h2>
          {s.today.total === 0 ? (
            <p className="mt-2 text-sm text-text-muted">
              No attendance marked today yet.{" "}
              <Link href="/dashboard/attendance" className="text-primary hover:underline">
                Mark attendance
              </Link>
            </p>
          ) : (
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-text-muted">Present</dt>
                <dd className="mt-0.5 font-semibold tnum">{s.today.present}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Absent</dt>
                <dd className="mt-0.5 font-semibold tnum">{s.today.absent}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Half / Leave</dt>
                <dd className="mt-0.5 font-semibold tnum">{s.today.half + s.today.leave}</dd>
              </div>
              <div>
                <dt className="text-text-muted">OT hours</dt>
                <dd className="mt-0.5 font-semibold tnum">{s.today.overtimeHours}</dd>
              </div>
            </dl>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-text">Low Stock</h2>
            {s.lowStockCount > 0 && <Badge tone="warning">{s.lowStockCount} item(s)</Badge>}
          </div>
          {s.lowStock.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">Every material is above minimum.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {s.lowStock.map((m) => (
                <li key={m._id} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="font-medium text-text">{m.name}</span>
                  <span className="tnum text-text-muted">
                    {m.currentStock} / min {m.minimumStock} {m.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/dashboard/stock" className="mt-3 inline-block text-sm text-primary hover:underline">
            Open stock
          </Link>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-base font-semibold text-text">Project Overview</h2>
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
          <ul className="mt-3 divide-y divide-border">
            {s.projects.map((p) => (
              <li key={p._id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <Link href={`/dashboard/projects/${p._id}`} className="font-medium text-primary hover:underline">
                    {p.name}
                  </Link>
                  <p className="truncate text-xs text-text-muted">
                    {p.clientName} · {p.location}
                  </p>
                  <ProgressBar value={p.progress} className="mt-2 max-w-xs" />
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="tnum text-text-muted">
                    {formatINR(p.expense)} / {formatINR(p.budget)}
                  </span>
                  <Badge tone={statusTone(p.status as ProjectStatus)}>{statusLabel(p.status as ProjectStatus)}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-base font-semibold text-text">Financial Summary</h2>
          <div className="mt-4 flex flex-col gap-4">
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Received vs pending</span>
                <span className="tnum">{receivedPct}% received</span>
              </div>
              <ProgressBar value={receivedPct} className="mt-2" />
              <p className="mt-1 text-xs text-text-muted tnum">
                {formatINR(s.receivedTotal)} received · {formatINR(s.outstandingTotal)} pending
              </p>
            </div>
            <div>
              <p className="text-sm text-text-muted">Monthly expenses (last 6 months)</p>
              <div className="mt-2 flex h-24 items-end gap-2">
                {s.monthlyExpenses.map((m) => (
                  <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-sm bg-primary"
                      style={{ height: `${Math.max(4, Math.round((m.amount / maxMonth) * 88))}px` }}
                      title={`${m.month}: ${formatINR(m.amount)}`}
                    />
                    <span className="text-[10px] text-text-muted">{m.month}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold text-text">Recent Activity</h2>
          {s.recentActivity.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">
              Activity appears here once attendance, purchases, expenses and payments are recorded.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2.5">
              {s.recentActivity.map((a, i) => (
                <li key={i} className="text-sm leading-5 text-text">
                  <span className="text-text-muted tnum">
                    {a.at.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                  </span>{" "}
                  — {a.text}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
