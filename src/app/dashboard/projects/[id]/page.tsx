import Link from "next/link";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { formatINR } from "@/lib/utils";
import { getProjectFinance } from "@/lib/finance";
import { Project } from "@/models/Project";
import { Site } from "@/models/Site";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { statusLabel, statusTone } from "@/components/projects/project-status";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) notFound();
  await connectDB();

  const project = await Project.findById(id).lean();
  if (!project) notFound();
  const [sites, finance] = await Promise.all([
    Site.find({ project: id }).sort({ createdAt: 1 }).lean(),
    getProjectFinance(id),
  ]);

  const pid = String(project._id);
  const hasStart = Boolean(project.startDate);
  const hasEnd = Boolean(project.expectedEndDate);
  const hasDescription = Boolean(project.description && String(project.description).trim().length > 0);

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
        title={project.name}
        action={
          <Link href={`/dashboard/projects/${pid}/edit`} aria-label="Edit project">
            <Button variant="outline" size="sm">Edit</Button>
          </Link>
        }
      />

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge tone={statusTone(project.status)}>
            {statusLabel(project.status)}
          </Badge>
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-muted tnum">{project.progress}%</span>
            <ProgressBar value={project.progress} className="w-[160px] sm:w-[220px]" />
          </div>
        </div>
        <div className="mt-4 border-t border-border" />
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-5">
          <div>
            <dt className="text-text-muted">Project Value</dt>
            <dd className="mt-1 font-semibold tnum">
              {formatINR(finance.contractValue)}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">Project Budget</dt>
            <dd className="mt-1 font-semibold tnum">
              {formatINR(project.budget)}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">Spent</dt>
            <dd className="mt-1 font-semibold tnum">
              {formatINR(finance.totalExpense)}
            </dd>
          </div>

          <div>
            <dt className="text-text-muted">Remaining Budget</dt>
            <dd className="mt-1 font-semibold tnum">
              {formatINR((project.budget) - (finance.totalExpense) )}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">Pending from Client</dt>
            <dd className="mt-1 font-semibold tnum">
              {formatINR(finance.pending)}
            </dd>
          </div>
        </dl>
       <div className="mt-6 border-t border-border pt-5">
  <div
    className={`grid grid-cols-1 gap-6 ${
      hasStart || hasEnd ? "sm:grid-cols-3" : "sm:grid-cols-2"
    }`}
  >
    <div>
      <p className="text-xs text-text-muted">Location</p>
      <p className="mt-1.5 text-sm font-medium text-text">
        {project.location || "—"}
      </p>
    </div>

    <div>
      <p className="text-xs text-text-muted">Client</p>
      <p className="mt-1.5 text-sm font-medium text-text">
        {project.clientName || "—"}
      </p>
    </div>

    {(hasStart || hasEnd) ? (
      <div>
        <p className="text-xs text-text-muted">Project Period</p>

        {hasStart && hasEnd ? (
          <p className="mt-1.5 text-sm font-medium text-text">
            {formatDMY(project.startDate as string | Date)}
            <span className="mx-2 text-text-muted">→</span>
            {formatDMY(project.expectedEndDate as string | Date)}
          </p>
        ) : hasStart ? (
          <p className="mt-1.5 text-sm font-medium text-text">
            From {formatDMY(project.startDate as string | Date)}
          </p>
        ) : (
          <p className="mt-1.5 text-sm font-medium text-text">
            Until {formatDMY(project.expectedEndDate as string | Date)}
          </p>
        )}
      </div>
    ) : null}
  </div>

  {hasDescription ? (
    <div className="mt-6 border-t border-border pt-5">
      <p className="text-xs text-text-muted">Description</p>
      <p className="mt-1.5 max-w-3xl text-sm leading-6 text-text">
        {project.description}
      </p>
    </div>
  ) : null}
</div>
      </Card>


      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-text">
            Profit &amp; Loss
          </h2>

          <div className="flex items-center gap-3">
            <Badge tone={finance.profit >= 0 ? "success" : "danger"}>
              {finance.profit >= 0 ? "Estimated Profit" : "Estimated Loss"}
            </Badge>

            <span className="text-sm text-text-muted">
              Margin {finance.margin.toFixed(1)}%
            </span>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-text-muted">Project Budget</dt>
            <dd className="mt-1 font-semibold tnum">
              {formatINR(project.budget)}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">Material Cost</dt>
            <dd className="mt-1 font-medium tnum">
              {formatINR(finance.materialExpense)}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">Labour Cost</dt>
            <dd className="mt-1 font-medium tnum">
              {formatINR(finance.labourExpense)}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">Other Expenses</dt>
            <dd className="mt-1 font-medium tnum">
              {formatINR(finance.manualExpenses)}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">Total Cost</dt>
            <dd className="mt-1 font-semibold tnum">
              {formatINR(finance.totalExpense)}
            </dd>
          </div>

          <div>
            <dt className="text-text-muted">Received from Client</dt>
            <dd className="mt-1 font-medium tnum">
              {formatINR(finance.received)}
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-text">Sites</h2>
          <span className="text-xs text-text-muted tnum">
            {sites.length} site{sites.length === 1 ? "" : "s"}
          </span>
        </div>
        {sites.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="No sites yet"
              description="Add the first site (e.g. Main Building) to start assigning labour and marking attendance."
            />
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {sites.map((s) => (
              <Card key={String(s._id)} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">{s.name}</p>
                    {s.supervisor ? (
                      <p className="mt-0.5 truncate text-xs text-text-muted">
                        {s.supervisor}
                      </p>
                    ) : null}
                  </div>
                  <Badge
                    tone={
                      s.status === "active"
                        ? "primary"
                        : s.status === "completed"
                          ? "success"
                          : "warning"
                    }
                  >
                    {s.status}
                  </Badge>
                </div>
                <ProgressBar value={s.progress} className="mt-2.5" />
                <div className="mt-2.5">
                  <span className="text-xs text-text-muted tnum">{s.progress}% Completed</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
