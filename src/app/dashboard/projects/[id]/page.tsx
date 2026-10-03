import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
import { derivedProjectProgress } from "@/lib/progress";

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
  // Project progress is derived from its sites — never stored separately.
  const progress = derivedProjectProgress(sites);
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
    <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
      <PageHeader
        title={project.name}
        action={
          <Link href={`/dashboard/projects/${pid}/edit`} aria-label="Edit project">
            <Button variant="outline" size="sm">Edit</Button>
          </Link>
        }
      />

      <Card className="rounded-xl p-4 sm:rounded-lg sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge tone={statusTone(project.status)}>
            {statusLabel(project.status)}
          </Badge>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5 sm:flex-none sm:gap-3">
            <span className="shrink-0 text-[13px] text-text-muted tnum sm:text-sm">{progress}%</span>
            <ProgressBar value={progress} className="w-full max-w-[160px] sm:w-[220px] sm:max-w-none" />
          </div>
        </div>

        <div className="mt-3.5 border-t border-border sm:mt-4" />

        <dl className="mt-3.5 grid grid-cols-2 gap-2.5 text-sm sm:mt-4 sm:grid-cols-5 sm:gap-4">
          <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
            <dt className="text-xs text-text-muted sm:text-sm">Project Value</dt>
            <dd className="mt-0.5 truncate text-[15px] font-semibold tnum sm:mt-1 sm:text-base">
              {formatINR(finance.contractValue)}
            </dd>
          </div>
          <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
            <dt className="text-xs text-text-muted sm:text-sm">Project Budget</dt>
            <dd className="mt-0.5 truncate text-[15px] font-semibold tnum sm:mt-1 sm:text-base">
              {formatINR(project.budget)}
            </dd>
          </div>
          <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
            <dt className="text-xs text-text-muted sm:text-sm">Spent</dt>
            <dd className="mt-0.5 truncate text-[15px] font-semibold tnum sm:mt-1 sm:text-base">
              {formatINR(finance.totalExpense)}
            </dd>
          </div>
          <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
            <dt className="text-xs text-text-muted sm:text-sm">Remaining Budget</dt>
            <dd className="mt-0.5 truncate text-[15px] font-semibold tnum sm:mt-1 sm:text-base">
              {formatINR((project.budget) - (finance.totalExpense) )}
            </dd>
          </div>
          <div className="col-span-2 min-w-0 sm:col-span-1 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
            <dt className="text-xs text-text-muted sm:text-sm">Pending from Client</dt>
            <dd className="mt-0.5 truncate text-[15px] font-semibold tnum sm:mt-1 sm:text-base">
              {formatINR(finance.pending)}
            </dd>
          </div>
        </dl>

        <div className="mt-4 border-t border-border pt-4 sm:mt-6 sm:pt-5">
          <div
            className={`grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-6 ${
              hasStart || hasEnd ? "sm:grid-cols-3" : "sm:grid-cols-2"
            }`}
          >
            <div className="min-w-0">
              <p className="text-xs text-text-muted">Location</p>
              <p className="mt-1 truncate text-sm font-medium text-text">
                {project.location || "—"}
              </p>
            </div>

            <div className="min-w-0">
              <p className="text-xs text-text-muted">Client</p>
              <p className="mt-1 truncate text-sm font-medium text-text">
                {project.clientName || "—"}
              </p>
            </div>

            {(hasStart || hasEnd) ? (
              <div className="col-span-2 min-w-0 sm:col-span-1">
                <p className="text-xs text-text-muted">Project Period</p>

                {hasStart && hasEnd ? (
                  <p className="mt-1 inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium text-text">
                    {formatDMY(project.startDate as string | Date)}
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                    {formatDMY(project.expectedEndDate as string | Date)}
                  </p>
                ) : hasStart ? (
                  <p className="mt-1 text-sm font-medium text-text">
                    From {formatDMY(project.startDate as string | Date)}
                  </p>
                ) : (
                  <p className="mt-1 text-sm font-medium text-text">
                    Until {formatDMY(project.expectedEndDate as string | Date)}
                  </p>
                )}
              </div>
            ) : null}
          </div>

          {hasDescription ? (
            <div className="mt-4 border-t border-border pt-4 sm:mt-6 sm:pt-5">
              <p className="text-xs text-text-muted">Description</p>
              <p className="mt-1.5 max-w-3xl text-sm leading-6 text-text">
                {project.description}
              </p>
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="rounded-xl p-4 sm:rounded-lg sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold tracking-tight text-text sm:text-base sm:tracking-normal">
            Profit &amp; Loss
          </h2>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Badge tone={finance.profit >= 0 ? "success" : "danger"}>
              {finance.profit >= 0 ? "Estimated Profit" : "Estimated Loss"}
            </Badge>

            <span className="text-xs text-text-muted sm:text-sm">
              Margin {finance.margin.toFixed(1)}%
            </span>
          </div>
        </div>
        <dl className="mt-3.5 grid grid-cols-2 gap-2.5 text-sm sm:mt-4 sm:grid-cols-3 sm:gap-4">
          <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
            <dt className="text-xs text-text-muted sm:text-sm">Project Budget</dt>
            <dd className="mt-0.5 truncate text-[15px] font-semibold tnum sm:mt-1 sm:text-base">
              {formatINR(project.budget)}
            </dd>
          </div>
          <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
            <dt className="text-xs text-text-muted sm:text-sm">Material Cost</dt>
            <dd className="mt-0.5 truncate text-[15px] font-medium tnum sm:mt-1 sm:text-base">
              {formatINR(finance.materialExpense)}
            </dd>
          </div>
          <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
            <dt className="text-xs text-text-muted sm:text-sm">Labour Cost</dt>
            <dd className="mt-0.5 truncate text-[15px] font-medium tnum sm:mt-1 sm:text-base">
              {formatINR(finance.labourExpense)}
            </dd>
          </div>
          <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
            <dt className="text-xs text-text-muted sm:text-sm">Other Expenses</dt>
            <dd className="mt-0.5 truncate text-[15px] font-medium tnum sm:mt-1 sm:text-base">
              {formatINR(finance.manualExpenses)}
            </dd>
          </div>
          <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
            <dt className="text-xs text-text-muted sm:text-sm">Total Cost</dt>
            <dd className="mt-0.5 truncate text-[15px] font-semibold tnum sm:mt-1 sm:text-base">
              {formatINR(finance.totalExpense)}
            </dd>
          </div>
          <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
            <dt className="text-xs text-text-muted sm:text-sm">Received from Client</dt>
            <dd className="mt-0.5 truncate text-[15px] font-medium tnum sm:mt-1 sm:text-base">
              {formatINR(finance.received)}
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="rounded-xl p-4 sm:rounded-lg sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold tracking-tight text-text sm:text-base sm:tracking-normal">
            Sites
          </h2>
          <span className="shrink-0 text-xs text-text-muted tnum">
            {sites.length} site{sites.length === 1 ? "" : "s"}
          </span>
        </div>
        {sites.length === 0 ? (
          <div className="mt-3.5 sm:mt-3">
            <EmptyState
              title="No sites yet"
              description="Add the first site (e.g. Main Building) to start assigning labour and marking attendance."
            />
          </div>
        ) : (
          <div className="scroll-area mt-3.5 grid max-h-[420px] grid-cols-1 gap-2.5 sm:mt-3 sm:max-h-none sm:grid-cols-2 sm:gap-2 sm:overflow-visible lg:grid-cols-3">
            {sites.map((s) => (
              <Link
                key={String(s._id)}
                href={`/dashboard/sites/${String(s._id)}`}
                className="outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-xl sm:rounded-lg"
              >
                <Card className="rounded-xl p-3.5 transition-colors hover:border-primary/40 active:bg-background sm:rounded-lg sm:p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-[15px] font-medium text-primary sm:text-sm">{s.name}</p>
                    <Badge
                      tone={
                        s.status === "active"
                          ? "primary"
                          : s.status === "completed"
                            ? "success"
                            : "warning"
                      }
                      className="shrink-0"
                    >
                      {s.status}
                    </Badge>
                  </div>
                  {s.supervisor ? (
                    <p className="mt-0.5 truncate text-xs text-text-muted">
                      {s.supervisor}
                    </p>
                  ) : null}
                  <div className="mt-2.5 flex items-center gap-2.5 sm:mt-2">
                    <ProgressBar value={s.progress} className="min-w-0 flex-1" />
                    <span className="shrink-0 text-xs tnum text-text-muted">{s.progress}%</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}