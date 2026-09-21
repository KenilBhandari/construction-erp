import Link from "next/link";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { formatDateShort, formatINR } from "@/lib/utils";
import { Site } from "@/models/Site";
import { Project } from "@/models/Project";
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

  const [currentLabour, attendanceAgg, purchaseAgg, expenseAgg, overtimeAgg, recentStock, recentAttendance] = await Promise.all([
    Labour.find({ assignedSite: sid }).sort({ name: 1 }).lean(),
    Attendance.aggregate([
      { $match: { site: sid } },
      {
        $lookup: {
          from: Labour.collection.name,
          localField: "labour",
          foreignField: "_id",
          as: "worker",
        },
      },
      { $unwind: "$worker" },
      {
        $group: {
          _id: null,
          presentDays: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
          halfDays: { $sum: { $cond: [{ $eq: ["$status", "half-day"] }, 1, 0] } },
          leaveDays: { $sum: { $cond: [{ $eq: ["$status", "leave"] }, 1, 0] } },
          absentDays: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
          cost: {
            $sum: {
              $add: [
                { $cond: [{ $eq: ["$status", "present"] }, "$worker.dailyRate", 0] },
                { $cond: [{ $eq: ["$status", "half-day"] }, { $multiply: ["$worker.dailyRate", 0.5] }, 0] },
                { $multiply: ["$overtimeHours", "$worker.hourlyRate"] },
              ],
            },
          },
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
    StockTransaction.find({ site: sid }).sort({ date: -1 }).limit(5).populate("material", "name unit").lean(),
    Attendance.find({ site: sid }).sort({ date: -1 }).limit(5).populate("labour", "name").lean(),
  ]);

  const attendanceCost = Math.round(attendanceAgg[0]?.cost ?? 0);
  const materialExpense = purchaseAgg[0]?.amount ?? 0;
  const overtimeAmount = overtimeAgg[0]?.amount ?? 0;
  const labourExpense = attendanceCost + overtimeAmount;
  const manualExpenses = expenseAgg[0]?.amount ?? 0;
  const totalExpense = materialExpense + labourExpense + manualExpenses;

  const sidStr = String(site._id);
  const projectId = project ? String(project._id) : "";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={site.name}
        description={`${project ? project.name : "No project"}${site.location ? ` · ${site.location}` : ""}${site.supervisor ? ` · ${site.supervisor}` : ""}`}
        action={
          <div className="flex gap-2">
            <Link href={`/dashboard/sites/${sidStr}/edit`}>
              <Button variant="outline" size="sm">Edit</Button>
            </Link>
            {projectId && (
              <Link href={`/dashboard/projects/${projectId}`}>
                <Button variant="outline" size="sm">View Project</Button>
              </Link>
            )}
          </div>
        }
      />

      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={site.status === "active" ? "primary" : site.status === "completed" ? "success" : "warning"}>{site.status}</Badge>
          <span className="text-sm text-text-muted tnum">{site.progress}% complete</span>
        </div>
        <ProgressBar value={site.progress} className="mt-3" />
        <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-text-muted">Project</dt>
            <dd className="mt-1 font-medium tnum">{project ? project.name : "—"}</dd>
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
        {(site.startDate || site.expectedEndDate) && (
          <p className="mt-4 text-sm text-text-muted">
            {site.startDate ? formatDateShort(site.startDate) : "—"} {" - "} {site.expectedEndDate ? formatDateShort(site.expectedEndDate) : "—"}
          </p>
        )}
        {site.notes && (
          <p className="mt-3 text-sm leading-6 text-text">
            <span className="text-text-muted">Notes - </span>
            {site.notes}
          </p>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="text-base font-semibold text-text">Site Costs</h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-text-muted">Material Purchases</dt>
            <dd className="mt-1 font-medium tnum">{formatINR(materialExpense)}</dd>
            <p className="text-xs text-text-muted">{purchaseAgg[0]?.count ?? 0} purchases</p>
          </div>
          <div>
            <dt className="text-text-muted">Labour Cost</dt>
            <dd className="mt-1 font-medium tnum">{formatINR(labourExpense)}</dd>
            <p className="text-xs text-text-muted">{attendanceAgg[0]?.presentDays ?? 0} present + {attendanceAgg[0]?.halfDays ?? 0} half</p>
          </div>
          <div>
            <dt className="text-text-muted">Overtime</dt>
            <dd className="mt-1 font-medium tnum">{formatINR(overtimeAmount)}</dd>
            <p className="text-xs text-text-muted">{overtimeAgg[0]?.count ?? 0} records</p>
          </div>
          <div>
            <dt className="text-text-muted">Other Expenses</dt>
            <dd className="mt-1 font-medium tnum">{formatINR(manualExpenses)}</dd>
            <p className="text-xs text-text-muted">{expenseAgg[0]?.count ?? 0} entries</p>
          </div>
          <div className="col-span-2 sm:col-span-4 border-t border-border pt-3">
            <dt className="text-text-muted">Total Site Cost</dt>
            <dd className="mt-1 font-semibold tnum text-base">{formatINR(totalExpense)}</dd>
          </div>
        </dl>
        <div className="mt-3 flex gap-4 text-sm">
          <Link href={`/dashboard/purchases?site=${sidStr}`} className="text-primary hover:underline">Purchases</Link>
          <Link href={`/dashboard/expenses?site=${sidStr}`} className="text-primary hover:underline">Expenses</Link>
          <Link href={`/dashboard/attendance?site=${sidStr}`} className="text-primary hover:underline">Attendance</Link>
        </div>
      </Card>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">Current Labour ({currentLabour.length})</h2>
          <Link href={`/dashboard/labour?site=${sidStr}`}>
            <Button size="sm" variant="outline">View All</Button>
          </Link>
        </div>
        {currentLabour.length === 0 ? (
          <EmptyState
            title="No labour assigned"
            description="Assign labour to this site to track attendance and costs. History is preserved per labour."
            action={
              <Link href={`/dashboard/labour`}>
                <Button>Assign Labour</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {currentLabour.map((l) => (
              <Card key={String(l._id)} className="p-3">
                <p className="truncate text-sm font-medium leading-tight text-text">{l.name}</p>
                <p className="truncate text-xs text-text-muted">{l.skill} · {formatINR(l.dailyRate)}/d</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="truncate text-xs text-text-muted">{l.phone}</span>
                  <Link href={`/dashboard/labour/${String(l._id)}`} className="shrink-0 text-xs text-primary hover:underline">View</Link>
                </div>
              </Card>
            ))}
          </div>
        )}
        <p className="text-xs text-text-muted">Only current assignments shown. Full assignment history is preserved per labour and viewable on the labour detail page.</p>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-base font-semibold text-text">Recent Purchases</h3>
          {recentStock.length === 0 ? (
            <p className="mt-3 text-sm text-text-muted">No purchases for this site yet.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {recentStock.map((t) => (
                <li key={String(t._id)} className="flex justify-between">
                  <span>{(t.material as unknown as { name: string })?.name ?? "Material"} · {t.quantity} {t.unit}</span>
                  <span className="tnum">{formatINR(t.total)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href={`/dashboard/purchases?site=${sidStr}`} className="mt-3 inline-block text-sm text-primary hover:underline">View all purchases</Link>
        </Card>
        <Card className="p-5">
          <h3 className="text-base font-semibold text-text">Recent Attendance</h3>
          {recentAttendance.length === 0 ? (
            <p className="mt-3 text-sm text-text-muted">No attendance recorded yet.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {recentAttendance.map((a) => (
                <li key={String(a._id)} className="flex justify-between">
                  <span>{(a.labour as unknown as { name: string })?.name ?? "Labour"} · {a.status}</span>
                  <span className="text-text-muted tnum">{formatDateShort(a.date)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href={`/dashboard/attendance?site=${sidStr}`} className="mt-3 inline-block text-sm text-primary hover:underline">View attendance</Link>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-base font-semibold text-text">Manage</h2>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          <Link href={`/dashboard/labour?site=${sidStr}`} className="text-primary hover:underline">Labour</Link>
          <Link href={`/dashboard/attendance?site=${sidStr}`} className="text-primary hover:underline">Attendance</Link>
          <Link href={`/dashboard/purchases?site=${sidStr}`} className="text-primary hover:underline">Purchases</Link>
          <Link href={`/dashboard/stock?site=${sidStr}`} className="text-primary hover:underline">Stock</Link>
          <Link href={`/dashboard/expenses?site=${sidStr}`} className="text-primary hover:underline">Expenses</Link>
        </div>
      </Card>
    </div>
  );
}
