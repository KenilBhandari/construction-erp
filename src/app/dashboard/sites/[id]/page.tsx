import Link from "next/link";
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
    <div className="flex flex-col gap-6">
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

      <Card className="p-5">
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
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-muted tnum">
              {site.progress}%
            </span>
            <ProgressBar
              value={site.progress}
              className="w-[160px] sm:w-[220px]"
            />
          </div>
        </div>
        <div className="mt-4 border-t border-border" />
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-text-muted">Project</dt>
            <dd className="mt-1 font-medium tnum">
              {project ? project.name : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">Supervisor</dt>
            <dd className="mt-1 font-medium tnum">{site.supervisor ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Location</dt>
            <dd className="mt-1 font-medium tnum">{site.location ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Current Labour</dt>
            <dd className="mt-1 font-semibold tnum">{currentLabour.length}</dd>
          </div>
        </dl>
        {hasStart && hasEnd ? (
          <p className="mt-4 text-sm text-text-muted">
            Period: {formatDMY(site.startDate as string | Date)} -{" "}
            {formatDMY(site.expectedEndDate as string | Date)}
          </p>
        ) : hasStart ? (
          <p className="mt-4 text-sm text-text-muted">
            Start - {formatDMY(site.startDate as string | Date)}
          </p>
        ) : hasEnd ? (
          <p className="mt-4 text-sm text-text-muted">
            End - {formatDMY(site.expectedEndDate as string | Date)}
          </p>
        ) : null}
        {hasNotes ? (
          <p className="mt-3 text-sm leading-6 text-text">
            <span className="text-text-muted">Notes - </span>
            {site.notes}
          </p>
        ) : null}
      </Card>

      <Card className="p-5">
        <h2 className="text-base font-semibold text-text">Site Costs</h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-text-muted">Material Purchases</dt>
            <dd className="mt-1 font-medium tnum">
              {formatINR(materialExpense)}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">Labour Cost</dt>
            <dd className="mt-1 font-medium tnum">
              {formatINR(labourExpense)}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">Overtime</dt>
            <dd className="mt-1 font-medium tnum">
              {formatINR(overtimeAmount)}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">Other Expenses</dt>
            <dd className="mt-1 font-medium tnum">
              {formatINR(manualExpenses)}
            </dd>
          </div>
          <div className="col-span-2 sm:col-span-4 border-t border-border pt-3">
            <dt className="text-text-muted">Total Site Cost</dt>
            <dd className="mt-1 font-semibold tnum text-base">
              {formatINR(totalExpense)}
            </dd>
          </div>
        </dl>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-base font-semibold text-text">
            Current Labour ({currentLabour.length})
          </h2>

          {currentLabour.length === 0 ? (
            <div className="mt-3">
              <EmptyState
                title="No labour assigned"
                description="Assign labour to this site to track attendance and costs."
              />
            </div>
          ) : (
            <div className="mt-4 max-h-[320px] overflow-y-auto rounded-md border border-border divide-y divide-border scrollbar-none">
              {currentLabour.map((l) => (
                <Link
                  key={String(l._id)}
                  href={`/dashboard/labour/${String(l._id)}`}
                  className="flex items-center justify-between gap-4 px-3.5 py-2.5 text-sm  hover:bg-background/70"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium text-text">{l.name}</span>
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

        <Card className="p-5">
          <h2 className="text-base font-semibold text-text">
            Recent Purchases
          </h2>

          {recentStock.length === 0 ? (
            <p className="mt-4 text-sm text-text-muted">
              No purchases for this site yet.
            </p>
          ) : (
            <div className="mt-4 max-h-[320px] overflow-y-auto rounded-md border border-border divide-y divide-border scrollbar-none">
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
