import Link from "next/link";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { formatDateShort, formatINR } from "@/lib/utils";
import { getProjectFinance } from "@/lib/finance";
import { Project } from "@/models/Project";
import { Site } from "@/models/Site";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { ProjectActions } from "@/components/projects/project-actions";
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={project.name}
        description={`${project.location} · ${project.clientName}`}
        action={<ProjectActions projectId={pid} projectName={project.name} />}
      />

      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={statusTone(project.status)}>
            {statusLabel(project.status)}
          </Badge>
          <span className="text-sm text-text-muted tnum">
            {project.progress}% complete
          </span>
        </div>
        <ProgressBar value={project.progress} className="mt-3" />
        <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-5">
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
        {(project.startDate || project.expectedEndDate) && (
          <p className="mt-4 text-sm text-text-muted">
            {project.startDate ? formatDateShort(project.startDate) : "—"}
            {" - "}
            {project.expectedEndDate
              ? formatDateShort(project.expectedEndDate)
              : "—"}
          </p>
        )}
        {project.description && (
          <p className="mt-3 text-sm leading-6 text-text">
            <span className="text-text-muted">Description - </span>
            {project.description}
          </p>
        )}
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

        <div className="mt-3 flex gap-4 text-sm">
          <Link
            href="/dashboard/expenses"
            className="text-primary hover:underline"
          >
            Expenses
          </Link>
          <Link
            href="/dashboard/payments"
            className="text-primary hover:underline"
          >
            Client payments
          </Link>
        </div>
      </Card>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">Sites</h2>
          <Link href={`/dashboard/sites/new?project=${pid}`}>
            <Button size="sm">Add Site</Button>
          </Link>
        </div>
        {sites.length === 0 ? (
          <EmptyState
            title="No sites yet"
            description="Add the first site (e.g. Main Building) to start assigning labour and marking attendance."
            action={
              <Link href={`/dashboard/sites/new?project=${pid}`}>
                <Button>Add Site</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {sites.map((s) => (
              <Card key={String(s._id)} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-text">{s.name}</p>
                    {s.supervisor && (
                      <p className="mt-0.5 text-sm text-text-muted">
            <span className="text-text-muted">Supervisor: </span>

                        {s.supervisor}
                      </p>
                    )}
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
                <ProgressBar value={s.progress} className="mt-3" />
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-text-muted tnum">{s.progress}% Completed</span>
                  <Link
                    href={`/dashboard/sites/${String(s._id)}/edit`}
                    className="text-primary hover:underline"
                  >
                    Edit
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Card className="p-5">
        <h2 className="text-base font-semibold text-text">Manage</h2>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          <Link
            href="/dashboard/labour"
            className="text-primary hover:underline"
          >
            Labour
          </Link>
          <Link
            href="/dashboard/attendance"
            className="text-primary hover:underline"
          >
            Attendance
          </Link>
          <Link
            href="/dashboard/purchases"
            className="text-primary hover:underline"
          >
            Purchases
          </Link>
          <Link
            href="/dashboard/reports"
            className="text-primary hover:underline"
          >
            Reports
          </Link>
        </div>
      </Card>
    </div>
  );
}
