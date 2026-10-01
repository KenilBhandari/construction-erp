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
import { ResponsiveDate } from "@/components/ui/responsive-date";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
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

/** Same status labels as the labour module — "Half Day", never "half-day". */
const STATUS_LABEL: Record<string, string> = {
  present: "Present",
  "half-day": "Half Day",
  absent: "Absent",
};

/**
 * Single placement label — site first, then project, "Unassigned" exactly
 * once when neither is known. Never "Unassigned · Unassigned".
 */
function placeLabel(projectName: string, siteName: string): string {
  const p = projectName === "—" ? "" : projectName;
  const s = siteName === "—" ? "" : siteName;
  if (s && p) return `${s} · ${p}`;
  return s || p || "Unassigned";
}

function isUnassigned(projectName: string, siteName: string): boolean {
  return projectName === "—" && siteName === "—";
}

/** Same type colors as the stock module. */
const TYPE_TONE = {
  purchase: "success",
  consumption: "neutral",
  adjustment: "warning",
  return: "primary",
} as const;

const TYPE_LABEL: Record<string, string> = {
  purchase: "Purchase",
  consumption: "Used",
  adjustment: "Adjustment",
  return: "Return",
};

function scopeEmpty(description: string) {
  return <EmptyState title="No entries found" description={description} />;
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
    <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
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
        <EmptyState
          title="Run a report"
          description={
            runner === "labour" || runner === "materials"
              ? `Select ${runner === "labour" ? "a worker" : "a material"} above and run the report.`
              : "Adjust filters above and run the report."
          }
        />
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
      <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
        <div>
          <h2 className="text-xl font-semibold uppercase">{r.header.name}</h2>
          <p className="text-xs text-text-muted">
            {r.header.unit ?? "No unit"} · {periodLabel(from, to)}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard label="Opening" value={qty(r.summary.opening)} />
          <StatCard label="Purchased" value={String(r.summary.purchased)} />
          <StatCard label="Consumed" value={String(r.summary.consumed)} />
          <StatCard label="Returned" value={String(r.summary.returned)} />
          <StatCard label="Adjustments" value={String(r.summary.adjustments)} />
          <StatCard
            label={r.summary.closing === null ? "Current" : "Closing"}
            value={String(r.summary.closing ?? r.summary.current)}
          />
        </div>
        <section className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">Monthly movement</h3>
          {r.trend.length === 0 ? (
            scopeEmpty("Try a different scope or period.")
          ) : (
            <>
              <ul className="flex flex-col gap-2 sm:hidden">
                {r.trend.map((m) => (
                  <li key={m.month}>
                    <Card className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 flex-1 truncate text-[15px] font-medium text-text">
                          {m.month}
                        </p>
                        <p className="shrink-0 text-[15px] font-semibold tnum text-text">
                          +{m.purchased} / −{m.consumed}
                        </p>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
              <div className="hidden sm:block">
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
              </div>
            </>
          )}
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">Transaction history</h3>
          {r.history.rows.length === 0 ? (
            scopeEmpty("Try a different scope or period.")
          ) : (
            <>
              <ul className="flex flex-col gap-2 sm:hidden">
                {r.history.rows.map((t) => (
                  <li key={t._id}>
                    <Card className="p-3">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="min-w-0 flex-1 truncate text-[15px] font-semibold tnum text-text">
                            {t.quantity > 0 ? `+${t.quantity}` : t.quantity}
                          </p>
                          <Badge
                            tone={TYPE_TONE[t.type as keyof typeof TYPE_TONE] ?? "neutral"}
                            className="shrink-0"
                          >
                            {TYPE_LABEL[t.type] ?? t.type}
                          </Badge>
                        </div>
                        <p className="min-w-0 truncate text-xs text-text-muted tnum">
                          {formatDateShort(t.date)}{t.siteName && t.siteName !== "—" ? ` · ${t.siteName}` : ""}
                        </p>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
              <div className="hidden sm:block">
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
                        <TD className="whitespace-nowrap tnum">
                          <ResponsiveDate date={t.date} />
                        </TD>
                        <TD>
                          <Badge tone={TYPE_TONE[t.type as keyof typeof TYPE_TONE] ?? "neutral"}>
                            {TYPE_LABEL[t.type] ?? t.type}
                          </Badge>
                        </TD>
                        <TD numeric>{t.quantity}</TD>
                        <TD>{t.siteName}</TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              </div>
            </>
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
      <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard label="Total" value={formatINR(r.summary.total)} />
        </div>
        <section className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">By category</h3>
          {r.byCategory.length === 0 ? (
            scopeEmpty("Try a different scope or period.")
          ) : (
            <>
              <ul className="flex flex-col gap-2 sm:hidden">
                {r.byCategory.map((c) => (
                  <li key={c.label}>
                    <Card className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 flex-1 truncate text-[15px] font-medium text-text">
                          {c.label}
                        </p>
                        <p className="shrink-0 text-[15px] font-semibold tnum text-text">
                          {formatINR(c.amount)}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-text-muted tnum">{c.share}% of total</p>
                    </Card>
                  </li>
                ))}
              </ul>
              <div className="hidden sm:block">
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
              </div>
            </>
          )}
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">Monthly trend</h3>
          {r.trend.length === 0 ? (
            scopeEmpty("Try a different scope or period.")
          ) : (
            <>
              <ul className="flex flex-col gap-2 sm:hidden">
                {r.trend.map((m) => (
                  <li key={m.month}>
                    <Card className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 flex-1 truncate text-[15px] font-medium text-text">
                          {m.month}
                        </p>
                        <p className="shrink-0 text-[15px] font-semibold tnum text-text">
                          {formatINR(m.amount)}
                        </p>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
              <div className="hidden sm:block">
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
              </div>
            </>
          )}
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">Transaction history</h3>
          {r.history.rows.length === 0 ? (
            scopeEmpty("Try a different scope or period.")
          ) : (
            <>
              <ul className="flex flex-col gap-2 sm:hidden">
                {r.history.rows.map((e) => (
                  <li key={e._id}>
                    <Card className="p-3">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="min-w-0 flex-1 truncate text-[15px] font-medium text-text">
                            {e.description}
                          </p>
                          <Badge tone="neutral" className="shrink-0">{e.category}</Badge>
                        </div>
                        <p className={`min-w-0 truncate text-xs tnum ${isUnassigned(e.projectName, e.siteName) ? "italic text-text-muted" : "text-text-muted"}`}>
                          {formatDateShort(e.date)} · {placeLabel(e.projectName, e.siteName)}
                        </p>
                        <p className="min-w-0 truncate text-[15px] font-semibold tnum text-text">
                          {formatINR(e.amount)}
                        </p>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
              <div className="hidden sm:block">
                <Table>
                  <THead>
                    <TR>
                      <TH>Date</TH>
                      <TH>Place</TH>
                      <TH>Category</TH>
                      <TH>Description</TH>
                      <TH numeric>Amount</TH>
                    </TR>
                  </THead>
                  <tbody>
                    {r.history.rows.map((e) => (
                      <TR key={e._id}>
                        <TD className="whitespace-nowrap tnum">
                          <ResponsiveDate date={e.date} />
                        </TD>
                        <TD className={isUnassigned(e.projectName, e.siteName) ? "text-text-muted italic" : ""}>
                          {placeLabel(e.projectName, e.siteName)}
                        </TD>
                        <TD>
                          <Badge tone="neutral">{e.category}</Badge>
                        </TD>
                        <TD>{e.description}</TD>
                        <TD numeric>{formatINR(e.amount)}</TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              </div>
            </>
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
    const totalEarned = salaryRows.reduce((n, s) => n + s.earned, 0);
    const totalPaid = salaryRows.reduce((n, s) => n + s.paid, 0);
    const totalOutstanding = salaryRows.reduce((n, s) => n + s.outstanding, 0);
    const totalAdvanceOutstanding = advanceRows.reduce((n, a) => n + a.outstanding, 0);
    // No write-offs anywhere in scope → the Written off column/segment is
    // omitted entirely instead of showing zeroes.
    const hasWrittenOff = advanceRows.some((a) => a.writtenOff > 0);
    return (
      <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard label="Earned" value={formatINR(totalEarned)} />
          <StatCard label="Paid" value={formatINR(totalPaid)} />
          <StatCard label="Outstanding" value={formatINR(totalOutstanding)} />
          <StatCard label="Advance Due" value={formatINR(totalAdvanceOutstanding)} />
        </div>
        <section className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">Salary</h3>
          {salaryRows.length === 0 ? (
            scopeEmpty("Try a different scope or period.")
          ) : (
            <>
              <ul className="flex flex-col gap-2 sm:hidden">
                {salaryRows.map((s) => (
                  <li key={s.labourId}>
                    <Card className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 flex-1 truncate text-[15px] font-medium text-text">
                          {s.name}
                        </p>
                        <div className="flex shrink-0 flex-col items-end">
                          <p className="text-[15px] font-semibold tnum text-text">
                            {formatINR(s.outstanding)}
                          </p>
                          <p className="text-[10px] leading-tight text-text-muted">Outstanding</p>
                        </div>
                      </div>
                      <p className="mt-1 min-w-0 truncate text-xs text-text-muted tnum">
                        Earned {formatINR(s.earned)} · Paid {formatINR(s.paid)}
                      </p>
                    </Card>
                  </li>
                ))}
              </ul>
              <div className="hidden sm:block">
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
              </div>
            </>
          )}
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">Advances</h3>
          {advanceRows.length > 0 ? (
            <>
              <ul className="flex flex-col gap-2 sm:hidden">
                {advanceRows.map((a) => (
                  <li key={a.labourId}>
                    <Card className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 flex-1 truncate text-[15px] font-medium text-text">
                          {a.name}
                        </p>
                        <div className="flex shrink-0 flex-col items-end">
                          <p className="text-[15px] font-semibold tnum text-text">
                            {formatINR(a.outstanding)}
                          </p>
                          <p className="text-[10px] leading-tight text-text-muted">Outstanding</p>
                        </div>
                      </div>
                      <p className="mt-1 min-w-0 truncate text-xs text-text-muted tnum">
                        Given {formatINR(a.given)} · Recovered {formatINR(a.recovered)}{a.writtenOff > 0 ? ` · Written off ${formatINR(a.writtenOff)}` : ""}
                      </p>
                    </Card>
                  </li>
                ))}
              </ul>
              <div className="hidden sm:block">
                <Table>
                  <THead>
                    <TR>
                      <TH>Worker</TH>
                      <TH numeric>Given</TH>
                      <TH numeric>Recovered</TH>
                      {hasWrittenOff && <TH numeric>Written off</TH>}
                      <TH numeric>Outstanding</TH>
                    </TR>
                  </THead>
                  <tbody>
                    {advanceRows.map((a) => (
                      <TR key={a.labourId}>
                        <TD className="font-medium">{a.name}</TD>
                        <TD numeric>{formatINR(a.given)}</TD>
                        <TD numeric>{formatINR(a.recovered)}</TD>
                        {hasWrittenOff && <TD numeric>{a.writtenOff > 0 ? formatINR(a.writtenOff) : ""}</TD>}
                        <TD numeric>{formatINR(a.outstanding)}</TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              </div>
            </>
          ) : (
            scopeEmpty("Try a different scope or period.")
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
  // No OT anywhere in scope → the OT column, OT line and OT stats are
  // omitted entirely instead of showing zeroes or em dashes.
  const hasOT = r.history.rows.some((a) => a.otHours > 0) || r.attendance.otHours > 0;
  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
      <div>
        <h2 className="text-xl font-semibold uppercase">{r.header.name}</h2>
        <p className="text-xs text-text-muted">
          {r.header.skill} · {periodLabel(from, to)}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Present" value={String(r.attendance.present)} />
        <StatCard label="Half / Absent" value={`${r.attendance.half} / ${r.attendance.absent}`} />
        {hasOT && <StatCard label="OT Hours" value={String(r.attendance.otHours)} />}
        <StatCard label="Labour Earned" value={formatINR(r.cost.earned)} />
        {hasOT && <StatCard label="Overtime" value={formatINR(r.cost.overtime)} />}
        <StatCard label="Total Cost" value={formatINR(r.cost.total)} />
        <StatCard label="Salary Paid" value={formatINR(r.salary.paid)} />
        <StatCard label="Salary Outstanding" value={formatINR(r.salary.outstanding)} />
        <StatCard label="Advance Outstanding" value={formatINR(r.advanceOutstanding)} />
      </div>
      <section className="flex flex-col gap-2">
        <h3 className="text-base font-semibold">Attendance history</h3>
        {r.history.rows.length === 0 ? (
          scopeEmpty("Try a different scope or period.")
        ) : (
          <>
            <ul className="flex flex-col gap-2 sm:hidden">
              {r.history.rows.map((a) => (
                <li key={a._id}>
                  <Card className="p-3">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 flex-1 truncate text-[15px] font-medium text-text tnum">
                          {formatDateShort(a.date)}
                        </p>
                        <Badge
                          tone={STATUS_TONE[a.status as keyof typeof STATUS_TONE] ?? "neutral"}
                          className="shrink-0"
                        >
                          {STATUS_LABEL[a.status] ?? a.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`min-w-0 flex-1 truncate text-xs ${isUnassigned(a.projectName, a.siteName) ? "italic text-text-muted" : "text-text-muted"}`}>
                          {placeLabel(a.projectName, a.siteName)}
                        </p>
                        {a.otHours > 0 && (
                          <p className="shrink-0 text-xs text-text-muted tnum">
                            OT {a.otHours}h
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
            <div className="hidden sm:block">
              <Table>
                <THead>
                  <TR>
                    <TH>Date</TH>
                    <TH>Place</TH>
                    <TH>Status</TH>
                    {hasOT && <TH numeric>OT hrs</TH>}
                  </TR>
                </THead>
                <tbody>
                  {r.history.rows.map((a) => (
                    <TR key={a._id}>
                      <TD className="tnum">
                        <ResponsiveDate date={a.date} />
                      </TD>
                      <TD className={isUnassigned(a.projectName, a.siteName) ? "text-text-muted italic" : ""}>
                        {placeLabel(a.projectName, a.siteName)}
                      </TD>
                      <TD>
                        <Badge tone={STATUS_TONE[a.status as keyof typeof STATUS_TONE] ?? "neutral"}>
                          {STATUS_LABEL[a.status] ?? a.status}
                        </Badge>
                      </TD>
                      {hasOT && <TD numeric>{a.otHours > 0 ? `${a.otHours}h` : ""}</TD>}
                    </TR>
                  ))}
                </tbody>
              </Table>
            </div>
          </>
        )}
        <Pager base={pagerBase} page={page} total={r.history.total} unit="records" />
      </section>
    </div>
  );
}
