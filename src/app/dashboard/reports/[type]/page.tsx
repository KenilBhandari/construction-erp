import Link from "next/link";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import { formatINR, formatDateShort } from "@/lib/utils";
import { Project } from "@/models/Project";
import { Site } from "@/models/Site";
import { Labour } from "@/models/Labour";
import { EXPENSE_CATEGORIES } from "@/types/finance";
import { getBulkAdvanceSummaries } from "@/lib/advances";
import {
  getLabourReportDetail,
  getMaterialReport,
  getExpenseRunnerReport,
  getSalaryAnalysis,
  getAdvanceReport,
} from "@/lib/reports";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { ReportScopeForm, type RunnerType } from "@/components/reports/report-scope-form";
import { Pager } from "@/components/reports/runner-blocks";
import { PdfButton } from "@/components/reports/section-export";

const TITLES: Record<RunnerType, string> = {
  labour: "Labour & Attendance",
  materials: "Materials & Stock",
  expenses: "Expenses",
  salary: "Salary & Advances",
};

function periodLabel(from?: string, to?: string): string {
  if (!from && !to) return "Lifetime";
  if (from && to) {
    if (from === to) return formatDateShort(from);
    return `${formatDateShort(from)} – ${formatDateShort(to)}`;
  }
  return `${from ? formatDateShort(from) : "…"} – ${to ? formatDateShort(to) : "…"}`;
}

/** Same status colors as the attendance module: present green, absent red, half-day amber. */
const STATUS_TONE = {
  present: "success",
  absent: "danger",
  "half-day": "warning",
} as const;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tnum">{value}</p>
    </Card>
  );
}

export default async function RunnerPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{
    project?: string;
    site?: string;
    worker?: string;
    material?: string;
    category?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const { type } = await params;
  if (
    type !== "labour" &&
    type !== "materials" &&
    type !== "expenses" &&
    type !== "salary"
  )
    notFound();
  const runner = type as RunnerType;

  await connectDB();
  const q = await searchParams;
  const projectId = q.project?.trim() || "";
  const siteId = q.site?.trim() || "";
  const labourId = q.worker?.trim() || "";
  const materialId = q.material?.trim() || "";
  const category = q.category?.trim() || "";
  const from = q.from?.trim() || "";
  const to = q.to?.trim() || "";
  const page = Math.max(1, Number(q.page) || 1);

  const { Material } = await import("@/models/Material");
  const [projects, sites, workers, materials] = await Promise.all([
    Project.find({}).sort({ name: 1 }).select("name startDate").lean(),
    Site.find({}).sort({ name: 1 }).select("name project").lean(),
    Labour.find({}).sort({ name: 1 }).select("name").lean(),
    Material.find({}).sort({ name: 1 }).select("name").lean(),
  ]);

  const ready =
    (runner === "labour" && labourId) ||
    (runner === "materials" && materialId) ||
    runner === "expenses" ||
    runner === "salary";

  const baseParams = new URLSearchParams();
  if (projectId) baseParams.set("project", projectId);
  if (siteId) baseParams.set("site", siteId);
  if (labourId) baseParams.set("worker", labourId);
  if (materialId) baseParams.set("material", materialId);
  if (category) baseParams.set("category", category);
  if (from) baseParams.set("from", from);
  if (to) baseParams.set("to", to);
  const baseQs = baseParams.toString();
  const pagerBase = `/dashboard/reports/${runner}${baseQs ? `?${baseQs}` : ""}`;
  const pdfHref = `/api/reports/${runner}/pdf${baseQs ? `?${baseQs}` : ""}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={TITLES[runner]}
        action={
          ready ? (
            <div className="no-print flex items-center gap-2">
              <PdfButton href={pdfHref} label="Print PDF" />
            </div>
          ) : undefined
        }
      />

      <div className="no-print">
        <ReportScopeForm
          type={runner}
          projects={(projects as Array<{ _id: unknown; name: string; startDate?: Date }>) .map((p) => ({
            _id: String(p._id),
            name: p.name,
            startDate: p.startDate ? new Date(p.startDate).toISOString() : null,
          }))}
          sites={(sites as Array<{ _id: unknown; name: string; project: unknown }>) .map((s) => ({
            _id: String(s._id),
            name: s.name,
            projectId: String(s.project),
          }))}
          workers={(workers as Array<{ _id: unknown; name: string }>).map((w) => ({
            _id: String(w._id),
            name: w.name,
          }))}
          materials={(materials as Array<{ _id: unknown; name: string }>).map((m) => ({
            _id: String(m._id),
            name: m.name,
          }))}
          categories={[...EXPENSE_CATEGORIES]}
          initial={{ projectId, siteId, labourId, materialId, category, from, to, preset: "custom" }}
        />
      </div>

      {!ready ? (
        <p className="text-sm text-text-muted">
          {runner === "labour" || runner === "materials"
            ? `Select ${runner === "labour" ? "a worker" : "a material"} above and run the report.`
            : "Adjust filters above and run the report."}
        </p>
      ) : (
        <ReportBody
          runner={runner}
          projectId={projectId}
          siteId={siteId}
          labourId={labourId}
          materialId={materialId}
          category={category}
          from={from}
          to={to}
          page={page}
          pagerBase={pagerBase}
        />
      )}
    </div>
  );
}

async function ReportBody({
  runner,
  projectId,
  siteId,
  labourId,
  materialId,
  category,
  from,
  to,
  page,
  pagerBase,
}: {
  runner: RunnerType;
  projectId: string;
  siteId: string;
  labourId: string;
  materialId: string;
  category: string;
  from: string;
  to: string;
  page: number;
  pagerBase: string;
}) {
  if (runner === "materials") {
    const r = await getMaterialReport({
      materialId,
      projectId: projectId || undefined,
      siteId: siteId || undefined,
      from: from || undefined,
      to: to || undefined,
      page,
    });
    const qty = (v: number | null) => (v === null ? "—" : String(v));
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-semibold uppercase">{r.header.name}</h2>
          <p className="text-xs text-text-muted">
            {r.header.unit ?? "No unit"} · {periodLabel(from, to)}
          </p>
        </div>
        <div className="grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Opening" value={qty(r.summary.opening)} />
          <Stat label="Purchased" value={String(r.summary.purchased)} />
          <Stat label="Consumed" value={String(r.summary.consumed)} />
          <Stat label="Returned" value={String(r.summary.returned)} />
          <Stat label="Adjustments" value={String(r.summary.adjustments)} />
          <Stat label={r.summary.closing === null ? "Current" : "Closing"} value={String(r.summary.closing ?? r.summary.current)} />
        </div>
        <section className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">Monthly movement</h3>
          {r.trend.length === 0 ? (
            <p className="text-sm text-text-muted">No movement in scope.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Month</TH>
                  <TH numeric>Purchased</TH>
                  <TH numeric>Consumed</TH>
                </TR>
              </THead>
              <tbody>
                {r.trend.map((m) => (
                  <TR key={m.month}>
                    <TD className="font-medium">{m.month}</TD>
                    <TD numeric>{m.purchased}</TD>
                    <TD numeric>{m.consumed}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">Transaction history</h3>
          {r.history.rows.length === 0 ? (
            <p className="text-sm text-text-muted">No transactions in scope.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH>Type</TH>
                  <TH numeric>Qty</TH>
                  <TH>Site</TH>
                </TR>
              </THead>
              <tbody>
                {r.history.rows.map((t) => (
                  <TR key={t._id}>
                    <TD>{formatDateShort(t.date)}</TD>
                    <TD className="capitalize">{t.type}</TD>
                    <TD numeric>{t.quantity}</TD>
                    <TD>{t.siteName}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
          <Pager base={pagerBase} page={page} total={r.history.total} />
        </section>
      </div>
    );
  }

  if (runner === "expenses") {
    const r = await getExpenseRunnerReport({
      projectId: projectId || undefined,
      siteId: siteId || undefined,
      category: category || undefined,
      from: from || undefined,
      to: to || undefined,
      page,
    });
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-semibold uppercase">Expenses</h2>
          <p className="text-xs text-text-muted">{periodLabel(from, to)}</p>
        </div>
        <div className="grid max-w-3xl grid-cols-2 gap-2">
          <Stat label="Total" value={formatINR(r.summary.total)} />
          <Stat label="Entries" value={String(r.summary.count)} />
        </div>
        <section className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">By category</h3>
          {r.byCategory.length === 0 ? (
            <p className="text-sm text-text-muted">No expenses in scope.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Category</TH>
                  <TH numeric>Amount</TH>
                  <TH numeric>Share</TH>
                </TR>
              </THead>
              <tbody>
                {r.byCategory.map((c) => (
                  <TR key={c.label}>
                    <TD className="font-medium">{c.label}</TD>
                    <TD numeric>{formatINR(c.amount)}</TD>
                    <TD numeric>{c.share}%</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">Monthly trend</h3>
          {r.trend.length === 0 ? (
            <p className="text-sm text-text-muted">No expenses in scope.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Month</TH>
                  <TH numeric>Amount</TH>
                </TR>
              </THead>
              <tbody>
                {r.trend.map((m) => (
                  <TR key={m.month}>
                    <TD className="font-medium">{m.month}</TD>
                    <TD numeric>{formatINR(m.amount)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">Transaction history</h3>
          {r.history.rows.length === 0 ? (
            <p className="text-sm text-text-muted">No expenses in scope.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH>Project</TH>
                  <TH>Site</TH>
                  <TH>Category</TH>
                  <TH>Description</TH>
                  <TH numeric>Amount</TH>
                </TR>
              </THead>
              <tbody>
                {r.history.rows.map((e) => (
                  <TR key={e._id}>
                    <TD>{formatDateShort(e.date)}</TD>
                    <TD>{e.projectName}</TD>
                    <TD>{e.siteName}</TD>
                    <TD>{e.category}</TD>
                    <TD>{e.description}</TD>
                    <TD numeric>{formatINR(e.amount)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
          <Pager base={pagerBase} page={page} total={r.history.total} />
        </section>
      </div>
    );
  }

  if (runner === "salary") {
    const [salaryRows, advanceRows] = await Promise.all([
      getSalaryAnalysis({
        from: from || undefined,
        to: to || undefined,
        labourId: labourId || undefined,
      }),
      (async () => {
        if (!labourId) {
          const r = await getAdvanceReport({ from: from || undefined, to: to || undefined });
          return r.rows;
        }
        const m = await getBulkAdvanceSummaries([labourId]);
        const s = m.get(labourId);
        if (!s || (s.totalGiven === 0 && s.outstanding === 0)) return [];
        const w = await Labour.findById(labourId).select("name").lean();
        return [
          {
            labourId,
            name: (w?.name as string) ?? "—",
            given: s.totalGiven,
            recovered: s.totalRecovered,
            writtenOff: s.totalWrittenOff,
            outstanding: s.outstanding,
          },
        ];
      })(),
    ]);
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-semibold uppercase">Salary & Advances</h2>
          <p className="text-xs text-text-muted">{periodLabel(from, to)}</p>
        </div>
        <section className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">Salary</h3>
          {salaryRows.length === 0 ? (
            <p className="text-sm text-text-muted">No salary settlements in scope.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Worker</TH>
                  <TH numeric>Earned</TH>
                  <TH numeric>Paid</TH>
                  <TH numeric>Outstanding</TH>
                </TR>
              </THead>
              <tbody>
                {salaryRows.map((s) => (
                  <TR key={s.labourId}>
                    <TD className="font-medium">{s.name}</TD>
                    <TD numeric>{formatINR(s.earned)}</TD>
                    <TD numeric>{formatINR(s.paid)}</TD>
                    <TD numeric>{formatINR(s.outstanding)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">Advances</h3>
          {advanceRows.length > 0 ? (
            <Table>
              <THead>
                <TR>
                  <TH>Worker</TH>
                  <TH numeric>Given</TH>
                  <TH numeric>Recovered</TH>
                  <TH numeric>Written off</TH>
                  <TH numeric>Outstanding</TH>
                </TR>
              </THead>
              <tbody>
                {advanceRows.map((a) => (
                  <TR key={a.labourId}>
                    <TD className="font-medium">{a.name}</TD>
                    <TD numeric>{formatINR(a.given)}</TD>
                    <TD numeric>{formatINR(a.recovered)}</TD>
                    <TD numeric>{formatINR(a.writtenOff)}</TD>
                    <TD numeric>{formatINR(a.outstanding)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="text-sm text-text-muted">No advances in scope.</p>
          )}
        </section>
      </div>
    );
  }

  const r = await getLabourReportDetail({
    labourId,
    projectId: projectId || undefined,
    siteId: siteId || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
  });
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold uppercase">{r.header.name}</h2>
        <p className="text-xs text-text-muted">
          {r.header.skill} · {periodLabel(from, to)}
        </p>
      </div>
      <div className="grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Present" value={String(r.attendance.present)} />
        <Stat label="Half / Absent" value={`${r.attendance.half} / ${r.attendance.absent}`} />
        <Stat label="OT Hours" value={String(r.attendance.otHours)} />
        <Stat label="Labour Earned" value={formatINR(r.cost.earned)} />
        <Stat label="Overtime" value={formatINR(r.cost.overtime)} />
        <Stat label="Total Cost" value={formatINR(r.cost.total)} />
        <Stat label="Salary Paid" value={formatINR(r.salary.paid)} />
        <Stat label="Salary Outstanding" value={formatINR(r.salary.outstanding)} />
        <Stat label="Advance Outstanding" value={formatINR(r.advanceOutstanding)} />
      </div>
      <section className="flex flex-col gap-2">
        <h3 className="text-base font-semibold">Attendance history</h3>
        {r.history.rows.length === 0 ? (
          <p className="text-sm text-text-muted">No attendance in scope.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Project</TH>
                <TH>Site</TH>
                <TH>Status</TH>
                <TH numeric>OT hrs</TH>
              </TR>
            </THead>
            <tbody>
              {r.history.rows.map((a) => (
                <TR key={a._id}>
                  <TD>{formatDateShort(a.date)}</TD>
                  <TD>{a.projectName}</TD>
                  <TD>{a.siteName}</TD>
                  <TD>
                    <Badge tone={STATUS_TONE[a.status as keyof typeof STATUS_TONE] ?? "neutral"}>
                      {a.status}
                    </Badge>
                  </TD>
                  <TD numeric>{a.otHours || "—"}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
        <Pager base={pagerBase} page={page} total={r.history.total} unit="records" />
      </section>
    </div>
  );
}

