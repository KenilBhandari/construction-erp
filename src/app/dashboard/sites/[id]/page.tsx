import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { formatINR } from "@/lib/utils";
import { Site } from "@/models/Site";
import { Project } from "@/models/Project";
// Ensure Project model is registered for populate("project")
void Project;
import { Labour } from "@/models/Labour";
import { Attendance } from "@/models/Attendance";
import { StockTransaction } from "@/models/StockTransaction";
import { Expense } from "@/models/Expense";
import { Overtime } from "@/models/Overtime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState } from "@/components/ui/empty-state";

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) notFound();
  await connectDB();

  const site = await Site.findById(id).populate("project", "name location clientName").lean();
  if (!site) notFound();
  const sid = new Types.ObjectId(id);
  const project = site.project as unknown as { _id: Types.ObjectId; name: string; location?: string; clientName?: string } | null;

  const [currentLabour, attendanceAgg, purchaseAgg, expenseAgg, overtimeAgg, recentStock] = await Promise.all([
    Labour.find({ assignedSite: sid }).sort({ name: 1 }).lean(),
    Attendance.aggregate([
      { $match: { site: sid } },
      {
        $group: {
          _id: null,
          presentDays: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
          halfDays: { $sum: { $cond: [{ $eq: ["$status", "half-day"] }, 1, 0] } },
          leaveDays: { $sum: { $cond: [{ $eq: ["$status", "leave"] }, 1, 0] } },
          absentDays: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
          cost: { $sum: { $ifNull: ["$cost", 0] } },
        },
      },
    ]),
    StockTransaction.aggregate([
      { $match: { site: sid, type: "purchase" } },
      { $group: { _id: null, amount: { $sum: "$total" }, count: { $sum: 1 } } },
    ]),
    Expense.aggregate([
      { $match: { site: sid } },
      { $group: { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    Overtime.aggregate([
      { $match: { site: sid } },
      { $group: { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    StockTransaction.find({ site: sid }).sort({ date: -1 }).limit(8).populate("material", "name unit").lean(),
  ]);

  const attendanceCost = Math.round(attendanceAgg[0]?.cost ?? 0);
  const materialExpense = purchaseAgg[0]?.amount ?? 0;
  const overtimeAmount = overtimeAgg[0]?.amount ?? 0;
  const labourExpense = attendanceCost + overtimeAmount;
  const manualExpenses = expenseAgg[0]?.amount ?? 0;
  const totalExpense = materialExpense + labourExpense + manualExpenses;

  const sidStr = String(site._id);

  const hasStart = Boolean(site.startDate);
  const hasEnd = Boolean(site.expectedEndDate);
  const hasNotes = Boolean(site.notes && String(site.notes).trim().length > 0);

  function formatDMY(date: string | Date): string {
    const d = typeof date === "string" ? new Date(date) : date;
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = d.getUTCFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
      <PageHeader
        title={site.name}
        action={
          <Link href={`/dashboard/sites/${sidStr}/edit`}>
            <Button variant="outline" size="sm">
              Edit
            </Button>
          </Link>
        }
      />

      <Card className="rounded-xl p-4 sm:rounded-lg sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge
            tone={
              site.status === "active"
                ? "primary"
                : site.status === "completed"
                  ? "success"
                  : "warning"
            }
          >
            {site.status}
          </Badge>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5 sm:flex-none sm:gap-3">
            <span className="shrink-0 text-[13px] text-text-muted tnum sm:text-sm">
              {site.progress}%
            </span>
            <ProgressBar
              value={site.progress}
              className="w-full max-w-[160px] sm:w-[220px] sm:max-w-none"
            />
          </div>
        </div>

        <div className="mt-3.5 border-t border-border sm:mt-4" />

        <dl className="mt-3.5 grid grid-cols-2 gap-2.5 text-sm sm:mt-4 sm:grid-cols-4 sm:gap-4">
          <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
            <dt className="text-xs text-text-muted sm:text-sm">Project</dt>
            <dd className="mt-0.5 truncate text-[15px] font-medium tnum sm:mt-1 sm:text-base">
              {project ? project.name : "—"}
            </dd>
          </div>
          <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
            <dt className="text-xs text-text-muted sm:text-sm">Supervisor</dt>
            <dd className="mt-0.5 truncate text-[15px] font-medium tnum sm:mt-1 sm:text-base">{site.supervisor ?? "—"}</dd>
          </div>
          <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
            <dt className="text-xs text-text-muted sm:text-sm">Location</dt>
            <dd className="mt-0.5 truncate text-[15px] font-medium tnum sm:mt-1 sm:text-base">{site.location ?? "—"}</dd>
          </div>
          <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
            <dt className="text-xs text-text-muted sm:text-sm">Current Labour</dt>
            <dd className="mt-0.5 truncate text-[15px] font-semibold tnum sm:mt-1 sm:text-base">{currentLabour.length}</dd>
          </div>
        </dl>
        {(hasStart || hasEnd || hasNotes) ? (
        <div className="mt-4 border-t border-border pt-4 sm:mt-6 sm:pt-5">
          {(hasStart || hasEnd) ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-6">
            <div className="col-span-2 min-w-0 sm:col-span-1">
              <p className="text-xs text-text-muted">Site Period</p>
              {hasStart && hasEnd ? (
                <p className="mt-1 inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium text-text">
                  {formatDMY(site.startDate as string | Date)}
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                  {formatDMY(site.expectedEndDate as string | Date)}
                </p>
              ) : hasStart ? (
                <p className="mt-1 text-sm font-medium text-text">
                  From {formatDMY(site.startDate as string | Date)}
                </p>
              ) : (
                <p className="mt-1 text-sm font-medium text-text">
                  Until {formatDMY(site.expectedEndDate as string | Date)}
                </p>
              )}
            </div>
          </div>
          ) : null}

          {hasNotes ? (
            <div className="mt-4 border-t border-border pt-4 sm:mt-6 sm:pt-5">
              <p className="text-xs text-text-muted">Notes</p>
              <p className="mt-1.5 max-w-3xl text-sm leading-6 text-text">
                {site.notes}
              </p>
            </div>
          ) : null}
        </div>
        ) : null}
      </Card>

      <Card className="rounded-xl p-4 sm:rounded-lg sm:p-5">
        <h2 className="text-[15px] font-semibold tracking-tight text-text sm:text-base sm:tracking-normal">Site Costs</h2>
        <dl className="mt-3.5 grid grid-cols-2 gap-2.5 text-sm sm:mt-4 sm:grid-cols-4 sm:gap-4">
          <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
            <dt className="text-xs text-text-muted sm:text-sm">Material Purchases</dt>
            <dd className="mt-0.5 truncate text-[15px] font-medium tnum sm:mt-1 sm:text-base">
              {formatINR(materialExpense)}
            </dd>
          </div>
          <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
            <dt className="text-xs text-text-muted sm:text-sm">Labour Cost</dt>
            <dd className="mt-0.5 truncate text-[15px] font-medium tnum sm:mt-1 sm:text-base">
              {formatINR(labourExpense)}
            </dd>
          </div>
          <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
            <dt className="text-xs text-text-muted sm:text-sm">Overtime</dt>
            <dd className="mt-0.5 truncate text-[15px] font-medium tnum sm:mt-1 sm:text-base">
              {formatINR(overtimeAmount)}
            </dd>
          </div>
          <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
            <dt className="text-xs text-text-muted sm:text-sm">Other Expenses</dt>
            <dd className="mt-0.5 truncate text-[15px] font-medium tnum sm:mt-1 sm:text-base">
              {formatINR(manualExpenses)}
            </dd>
          </div>
          <div className="col-span-2 sm:col-span-4 border-t border-border pt-3">
            <dt className="text-xs text-text-muted sm:text-sm">Total Site Cost</dt>
            <dd className="mt-0.5 truncate text-[15px] font-semibold tnum sm:mt-1 sm:text-base">
              {formatINR(totalExpense)}
            </dd>
          </div>
        </dl>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <Card className="rounded-xl p-4 sm:rounded-lg sm:p-5">
          <h2 className="text-[15px] font-semibold tracking-tight text-text sm:text-base sm:tracking-normal">
            Current Labour ({currentLabour.length})
          </h2>

          {currentLabour.length === 0 ? (
            <div className="mt-3.5 sm:mt-3">
              <EmptyState
                title="No labour assigned"
                description="Assign labour to this site to track attendance and costs."
              />
            </div>
          ) : (
            <div className="scroll-area mt-3.5 max-h-[320px] overflow-y-auto rounded-xl border border-border divide-y divide-border sm:mt-3 sm:rounded-lg">
              {currentLabour.map((l) => (
                <Link
                  key={String(l._id)}
                  href={`/dashboard/labour/${String(l._id)}`}
                  className="flex items-center justify-between gap-4 px-3.5 py-2.5 text-sm hover:bg-background/70"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium text-primary">{l.name}</span>
                    <span className="text-text-muted"> · {l.skill}</span>
                  </span>

                  <span className="shrink-0 text-sm font-medium tnum text-text">
                    {formatINR(l.dailyRate)}/day
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="rounded-xl p-4 sm:rounded-lg sm:p-5">
          <h2 className="text-[15px] font-semibold tracking-tight text-text sm:text-base sm:tracking-normal">
            Recent Purchases
          </h2>

          {recentStock.length === 0 ? (
            <p className="mt-3.5 text-sm text-text-muted sm:mt-3">
              No purchases for this site yet.
            </p>
          ) : (
            <div className="scroll-area mt-3.5 max-h-[320px] overflow-y-auto rounded-xl border border-border divide-y divide-border sm:mt-3 sm:rounded-lg">
              {recentStock.map((t) => (
                <div
                  key={String(t._id)}
                  className="flex items-center justify-between gap-4 px-3.5 py-2.5 text-sm"
                >
                  <span className="min-w-0 truncate text-text">
                    {(t.material as unknown as { name: string })?.name ??
                      "Material"}
                    <span className="text-text-muted">
                      {" "}
                      · {t.quantity} {t.unit}
                    </span>
                  </span>

                  <span className="shrink-0 text-sm font-medium tnum text-text">
                    {formatINR(t.total)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
