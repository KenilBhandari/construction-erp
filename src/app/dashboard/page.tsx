import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { connectDB } from "@/lib/mongodb";
import { formatINR, formatCompactINR, formatDateShort } from "@/lib/utils";
import { getDashboardSummary } from "@/lib/dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState } from "@/components/ui/empty-state";
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
 */
export default async function DashboardPage() {
  await connectDB();
  const s = await getDashboardSummary();

  const maxMonth = Math.max(1, ...s.monthlyExpenses.map((m) => m.amount));
  const contracted = s.contractsTotal;
  const receivedPct =
    contracted > 0 ? Math.round((s.receivedTotal / contracted) * 100) : 0;
  const currentMonth = s.monthlyExpenses[s.monthlyExpenses.length - 1];
  const prevMonths = s.monthlyExpenses.slice(-4, -1).reverse();

  const attention: { text: string; href: string }[] = [];
  if (s.lowStockCount > 0) {
    attention.push({
      text: `${s.lowStockCount} stock item(s) below minimum — ${s.lowStock.map((m) => m.name).join(", ")}`,
      href: "/dashboard/stock",
    });
  }
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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="How is the construction business doing today?"
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-base font-semibold text-text">Today&apos;s Operations</h2>
          {s.today.total === 0 ? (
            <p className="mt-2 text-sm text-text-muted">
              No attendance marked today yet.{" "}
              <Link href="/dashboard/attendance" className="inline-flex items-center gap-1 text-primary hover:underline">
                Mark attendance <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </p>
          ) : (
            <>
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
              <Link href="/dashboard/attendance" className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                View attendance <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-text">Needs Attention</h2>
            {attention.length > 0 && <Badge tone="warning">{attention.length}</Badge>}
          </div>
          {attention.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">All clear — nothing needs attention.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {attention.map((a) => (
                <li key={a.text} className="py-1.5 text-sm">
                  <Link href={a.href} className="inline-flex items-center gap-1 text-text hover:text-primary hover:underline">
                    {a.text} <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

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
            {s.projects.map((p) => {
              const pct = p.budget > 0 ? Math.round((p.expense / p.budget) * 100) : 0;
              return (
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
                      {formatCompactINR(p.expense)} / {formatCompactINR(p.budget)} · {pct}% used
                    </span>
                    <Badge tone={statusTone(p.status as ProjectStatus)}>{statusLabel(p.status as ProjectStatus)}</Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="text-base font-semibold text-text">Client Payments</h2>
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
          <div className="mt-3 flex justify-between text-sm">
            <span className="text-text-muted">Received vs pending</span>
            <span className="tnum">{receivedPct}% received</span>
          </div>
          <ProgressBar value={receivedPct} className="mt-2" />
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold text-text">Today&apos;s Spending</h2>
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
          <div className="mt-3 flex gap-4 text-sm">
            {s.todayPurchases > 0 && (
              <Link href="/dashboard/purchases" className="inline-flex items-center gap-1 text-primary hover:underline">
                View purchases <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
            {s.todayExpenses > 0 && (
              <Link href="/dashboard/expenses" className="inline-flex items-center gap-1 text-primary hover:underline">
                View expenses <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
            {s.todayPurchases === 0 && s.todayExpenses === 0 && (
              <span className="text-text-muted">Nothing recorded today.</span>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold text-text">Labour Cost</h2>
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-base font-semibold text-text">Monthly Expenses</h2>
          {currentMonth && (
            <p className="mt-2 text-sm tnum">
              <span className="font-semibold">{currentMonth.month}</span>{" "}
              <span className="text-text-muted">{formatINR(currentMonth.amount)}</span>
            </p>
          )}
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
          {prevMonths.length > 0 && (
            <ul className="mt-3 divide-y divide-border">
              {prevMonths.map((m) => (
                <li key={m.month} className="flex justify-between py-1.5 text-sm">
                  <span className="text-text-muted">{m.month}</span>
                  <span className="tnum">{formatINR(m.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold text-text">Recent Activity</h2>
          {s.recentActivity.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">
              Activity appears here once attendance, purchases, expenses and payments are recorded.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2.5">
              {s.recentActivity.map((a, i) => {
                const sameDay =
                  a.eventDate &&
                  a.eventDate.toISOString().slice(0, 10) === a.at.toISOString().slice(0, 10);
                return (
                  <li key={i} className="text-sm leading-5 text-text">
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
