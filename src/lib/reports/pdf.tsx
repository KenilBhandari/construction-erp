import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatINR, formatDateShort } from "@/lib/utils";
import type { ProjectReport } from "@/lib/reports/project-runner";
import type { SiteReport } from "@/lib/reports/site-runner";
import type { LabourReportDetail } from "@/lib/reports/labour-runner";
import type { MaterialReport } from "@/lib/reports/material-runner";
import type { ExpenseRunnerReport } from "@/lib/reports/expense-runner";
import type { PaymentRunnerReport } from "@/lib/reports/payment-runner";
import type { CashFlowMonth } from "@/lib/reports/cashflow";
import type { SalaryWorkerRow, AdvanceWorkerRow } from "@/lib/reports/salary";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: "#1c1c1c" },
  title: { fontSize: 16, fontWeight: "bold", textTransform: "uppercase" },
  subtitle: { fontSize: 9, color: "#6b6b6b", marginTop: 2 },
  scopeBox: { marginTop: 10, padding: 8, backgroundColor: "#f5f5f5" },
  scopeLine: { fontSize: 8, color: "#444", marginBottom: 2 },
  section: { marginTop: 14 },
  sectionTitle: { fontSize: 11, fontWeight: "bold", marginBottom: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  stat: { width: "31%", border: "1pt solid #e5e5e5", padding: 6, marginBottom: 6 },
  statLabel: { fontSize: 7, color: "#6b6b6b" },
  statValue: { fontSize: 11, fontWeight: "bold", marginTop: 2 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderBottom: "1pt solid #eee" },
  cell: { fontSize: 9 },
  muted: { fontSize: 8, color: "#6b6b6b" },
  footer: { marginTop: 16, fontSize: 7, color: "#999" },
});

function ScopeBlock({ lines }: { lines: string[] }) {
  return (
    <View style={styles.scopeBox}>
      {lines.map((l) => (
        <Text key={l} style={styles.scopeLine}>
          {l}
        </Text>
      ))}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function periodLabel(from?: string, to?: string): string {
  if (!from && !to) return "Lifetime";
  if (from && to && from === to) return formatDateShort(from);
  return `${from ? formatDateShort(from) : "…"} – ${to ? formatDateShort(to) : "…"}`;
}

export function ProjectPdf({
  report,
  scope,
}: {
  report: ProjectReport;
  scope: { from?: string; to?: string; siteName?: string; generatedAt: string };
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{report.header.name}</Text>
        <Text style={styles.subtitle}>Project Financials · {report.header.clientName} · {report.header.status}</Text>
        <ScopeBlock
          lines={[
            `Period: ${periodLabel(scope.from, scope.to)}${scope.siteName ? ` · Site: ${scope.siteName}` : ""}`,
            `Contract Value: ${formatINR(report.header.contractValue)}`,
            `Generated: ${scope.generatedAt}`,
          ]}
        />
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.grid}>
            <Stat label="Contract" value={formatINR(report.summary.contract)} />
            <Stat label="Total Cost" value={formatINR(report.summary.cost)} />
            <Stat label="Received" value={formatINR(report.summary.received)} />
            <Stat label="Outstanding" value={formatINR(report.summary.outstanding)} />
            <Stat label="Profit" value={formatINR(report.summary.profit)} />
            <Stat label="Margin" value={`${report.summary.margin.toFixed(1)}%`} />
          </View>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cost breakdown</Text>
          <View style={styles.row}><Text style={styles.cell}>Labour</Text><Text style={styles.cell}>{formatINR(report.costBreakdown.labour)}</Text></View>
          <View style={styles.row}><Text style={styles.cell}>Materials</Text><Text style={styles.cell}>{formatINR(report.costBreakdown.materials)}</Text></View>
          <View style={styles.row}><Text style={styles.cell}>Overtime</Text><Text style={styles.cell}>{formatINR(report.costBreakdown.overtime)}</Text></View>
          <View style={styles.row}><Text style={styles.cell}>Expenses</Text><Text style={styles.cell}>{formatINR(report.costBreakdown.expenses)}</Text></View>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monthly cost trend</Text>
          {report.trend.map((m) => (
            <View key={m.month} style={styles.row}>
              <Text style={styles.cell}>{m.month}</Text>
              <Text style={styles.cell}>
                L {formatINR(m.labour)} · M {formatINR(m.materials)} · E {formatINR(m.expenses)}
              </Text>
            </View>
          ))}
        </View>
        {report.siteBreakdown.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Site breakdown</Text>
            {report.siteBreakdown.map((s) => (
              <View key={s.siteId} style={styles.row}>
                <Text style={styles.cell}>{s.name}</Text>
                <Text style={styles.cell}>{formatINR(s.totalCost)}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client payments ({report.payments.total})</Text>
          {report.payments.rows.map((p) => (
            <View key={p._id} style={styles.row}>
              <Text style={styles.cell}>
                {formatDateShort(p.date)} · {p.paymentMethod}
                {p.notes ? ` · ${p.notes}` : ""}
              </Text>
              <Text style={styles.cell}>{formatINR(p.amount)}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.footer}>
          Profit = Contract Value − Recorded Project Costs (purchases + attendance labour + overtime + manual expenses).
        </Text>
      </Page>
    </Document>
  );
}

export function SitePdf({
  report,
  scope,
}: {
  report: SiteReport;
  scope: { from?: string; to?: string; generatedAt: string };
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{report.header.name}</Text>
        <Text style={styles.subtitle}>Site Performance · {report.header.projectName}</Text>
        <ScopeBlock lines={[`Period: ${periodLabel(scope.from, scope.to)}`, `Generated: ${scope.generatedAt}`]} />
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.grid}>
            <Stat label="Total Cost" value={formatINR(report.totals.total)} />
            <Stat label="Labour" value={formatINR(report.totals.labour)} />
            <Stat label="Materials" value={formatINR(report.totals.materials)} />
            <Stat label="Expenses" value={formatINR(report.totals.expenses)} />
          </View>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monthly cost trend</Text>
          {report.trend.map((m) => (
            <View key={m.month} style={styles.row}>
              <Text style={styles.cell}>{m.month}</Text>
              <Text style={styles.cell}>
                L {formatINR(m.labour)} · M {formatINR(m.materials)} · E {formatINR(m.expenses)}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Labour by worker</Text>
          {report.labourByWorker.map((w) => (
            <View key={w.labourId} style={styles.row}>
              <Text style={styles.cell}>{w.name}</Text>
              <Text style={styles.cell}>
                P {w.present} · H {w.half} · A {w.absent} · OT {w.otHours}h
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Materials</Text>
          {report.materialsByMaterial.map((m) => (
            <View key={m.materialId} style={styles.row}>
              <Text style={styles.cell}>{m.name}</Text>
              <Text style={styles.cell}>
                Purchased {m.purchased} · Consumed {m.consumed}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expense history ({report.expenseHistory.total})</Text>
          {report.expenseHistory.rows.map((e) => (
            <View key={e._id} style={styles.row}>
              <Text style={styles.cell}>
                {formatDateShort(e.date)} · {e.category}
              </Text>
              <Text style={styles.cell}>{formatINR(e.amount)}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.footer}>Labour = attendance snapshot cost + overtime. Materials = attributed purchases.</Text>
      </Page>
    </Document>
  );
}

export function MaterialsPdf({
  report,
  scope,
}: {
  report: MaterialReport;
  scope: { from?: string; to?: string; generatedAt: string };
}) {
  const qty = (v: number | null) => (v === null ? "—" : String(v));
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{report.header.name}</Text>
        <Text style={styles.subtitle}>Materials & Stock · {report.header.unit ?? "No unit"}</Text>
        <ScopeBlock lines={[`Period: ${periodLabel(scope.from, scope.to)}`, `Generated: ${scope.generatedAt}`]} />
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary (quantities)</Text>
          <View style={styles.grid}>
            <Stat label="Opening" value={qty(report.summary.opening)} />
            <Stat label="Purchased" value={String(report.summary.purchased)} />
            <Stat label="Consumed" value={String(report.summary.consumed)} />
            <Stat label="Returned" value={String(report.summary.returned)} />
            <Stat label="Adjustments" value={String(report.summary.adjustments)} />
            <Stat label="Closing" value={qty(report.summary.closing)} />
          </View>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monthly movement</Text>
          {report.trend.map((m) => (
            <View key={m.month} style={styles.row}>
              <Text style={styles.cell}>{m.month}</Text>
              <Text style={styles.cell}>
                Purchased {m.purchased} · Consumed {m.consumed}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transaction history ({report.history.total})</Text>
          {report.history.rows.map((t) => (
            <View key={t._id} style={styles.row}>
              <Text style={styles.cell}>
                {formatDateShort(t.date)} · {t.type} · {t.siteName}
              </Text>
              <Text style={styles.cell}>{t.quantity}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.footer}>
          Balances reconcile against live stock only for unfiltered lifetime flows — scoped views show flows, never manufactured balances.
        </Text>
      </Page>
    </Document>
  );
}

export function ExpensesPdf({
  report,
  scope,
}: {
  report: ExpenseRunnerReport;
  scope: { from?: string; to?: string; generatedAt: string };
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Expenses</Text>
        <Text style={styles.subtitle}>Expense history and breakdowns</Text>
        <ScopeBlock lines={[`Period: ${periodLabel(scope.from, scope.to)}`, `Generated: ${scope.generatedAt}`]} />
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.grid}>
            <Stat label="Total" value={formatINR(report.summary.total)} />
            <Stat label="Entries" value={String(report.summary.count)} />
          </View>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>By category</Text>
          {report.byCategory.map((c) => (
            <View key={c.label} style={styles.row}>
              <Text style={styles.cell}>{c.label}</Text>
              <Text style={styles.cell}>
                {formatINR(c.amount)} · {c.share}%
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monthly trend</Text>
          {report.trend.map((m) => (
            <View key={m.month} style={styles.row}>
              <Text style={styles.cell}>{m.month}</Text>
              <Text style={styles.cell}>{formatINR(m.amount)}</Text>
            </View>
          ))}
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transaction history ({report.history.total})</Text>
          {report.history.rows.map((e) => (
            <View key={e._id} style={styles.row}>
              <Text style={styles.cell}>
                {formatDateShort(e.date)} · {e.projectName} · {e.siteName} · {e.category} · {e.description}
              </Text>
              <Text style={styles.cell}>{formatINR(e.amount)}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.footer}>Manual expenses only — purchases and salary are separate cost heads.</Text>
      </Page>
    </Document>
  );
}

export function PaymentsPdf({
  report,
  scope,
}: {
  report: PaymentRunnerReport;
  scope: { from?: string; to?: string; generatedAt: string };
}) {
  const money = (v: number | null) => (v === null ? "—" : formatINR(v));
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{report.header.projectName ?? "All Projects"}</Text>
        <Text style={styles.subtitle}>Client Payments</Text>
        <ScopeBlock lines={[`Period: ${periodLabel(scope.from, scope.to)}`, `Generated: ${scope.generatedAt}`]} />
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.grid}>
            <Stat label="Contract" value={money(report.summary.contract)} />
            <Stat label="Received" value={formatINR(report.summary.received)} />
            <Stat label="Outstanding" value={money(report.summary.outstanding)} />
            <Stat label="Payments" value={String(report.summary.count)} />
          </View>
        </View>
        {report.byProject.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Received by project</Text>
            {report.byProject.map((p) => (
              <View key={p.projectId} style={styles.row}>
                <Text style={styles.cell}>{p.name}</Text>
                <Text style={styles.cell}>{formatINR(p.received)}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment history ({report.history.total})</Text>
          {report.history.rows.map((p) => (
            <View key={p._id} style={styles.row}>
              <Text style={styles.cell}>
                {formatDateShort(p.date)} · {p.projectName} · {p.paymentMethod}
                {p.notes ? ` · ${p.notes}` : ""}
              </Text>
              <Text style={styles.cell}>{formatINR(p.amount)}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.footer}>
          Outstanding = Contract Value − Recorded Client Payments. No aging — no due dates exist.
        </Text>
      </Page>
    </Document>
  );
}

export function CashFlowPdf({
  months,
  scope,
}: {
  months: CashFlowMonth[];
  scope: { from?: string; to?: string; generatedAt: string };
}) {
  const inflow = months.reduce((s, m) => s + m.inflow, 0);
  const outflow = months.reduce((s, m) => s + m.outflow, 0);
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Cash Flow</Text>
        <Text style={styles.subtitle}>Historical money in and out</Text>
        <ScopeBlock lines={[`Period: ${periodLabel(scope.from, scope.to)}`, `Generated: ${scope.generatedAt}`]} />
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.grid}>
            <Stat label="Inflow" value={formatINR(inflow)} />
            <Stat label="Outflow" value={formatINR(outflow)} />
            <Stat label="Net" value={formatINR(inflow - outflow)} />
          </View>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>By period</Text>
          {months.map((m) => (
            <View key={m.month} style={styles.row}>
              <Text style={styles.cell}>
                {m.month} · Sal {formatINR(m.salaryOutflow)} · Mat {formatINR(m.purchaseOutflow)} · Exp{" "}
                {formatINR(m.expenseOutflow)}
              </Text>
              <Text style={styles.cell}>
                In {formatINR(m.inflow)} · Net {formatINR(m.net)}
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.footer}>Historical movement only — not a forecast.</Text>
      </Page>
    </Document>
  );
}

export function SalaryPdf({
  salaryRows,
  advanceRows,
  scope,
}: {
  salaryRows: SalaryWorkerRow[];
  advanceRows: AdvanceWorkerRow[];
  scope: { from?: string; to?: string; generatedAt: string };
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Salary & Advances</Text>
        <Text style={styles.subtitle}>Earnings, payments, balances and advances</Text>
        <ScopeBlock lines={[`Period: ${periodLabel(scope.from, scope.to)}`, `Generated: ${scope.generatedAt}`]} />
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Salary</Text>
          {salaryRows.map((s) => (
            <View key={s.labourId} style={styles.row}>
              <Text style={styles.cell}>{s.name}</Text>
              <Text style={styles.cell}>
                Earned {formatINR(s.earned)} · Paid {formatINR(s.paid)} · Due {formatINR(s.outstanding)}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Advances</Text>
          {advanceRows.map((a) => (
            <View key={a.labourId} style={styles.row}>
              <Text style={styles.cell}>{a.name}</Text>
              <Text style={styles.cell}>
                Given {formatINR(a.given)} · Recovered {formatINR(a.recovered)} · Written off{" "}
                {formatINR(a.writtenOff)} · Due {formatINR(a.outstanding)}
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.footer}>
          Outstanding = Given − Recovered − Written Off. Recovery is explicit per settlement, never automatic.
        </Text>
      </Page>
    </Document>
  );
}

export function LabourPdf({
  report,
  scope,
}: {
  report: LabourReportDetail;
  scope: { from?: string; to?: string; generatedAt: string };
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{report.header.name}</Text>
        <Text style={styles.subtitle}>Labour & Attendance · {report.header.skill}</Text>
        <ScopeBlock lines={[`Period: ${periodLabel(scope.from, scope.to)}`, `Generated: ${scope.generatedAt}`]} />
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.grid}>
            <Stat label="Present" value={String(report.attendance.present)} />
            <Stat label="Half / Absent" value={`${report.attendance.half} / ${report.attendance.absent}`} />
            <Stat label="OT Hours" value={String(report.attendance.otHours)} />
            <Stat label="Labour Earned" value={formatINR(report.cost.earned)} />
            <Stat label="Overtime" value={formatINR(report.cost.overtime)} />
            <Stat label="Total Cost" value={formatINR(report.cost.total)} />
            <Stat label="Salary Paid" value={formatINR(report.salary.paid)} />
            <Stat label="Salary Outstanding" value={formatINR(report.salary.outstanding)} />
            <Stat label="Advance Outstanding" value={formatINR(report.advanceOutstanding)} />
          </View>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attendance history ({report.history.total})</Text>
          {report.history.rows.map((a) => (
            <View key={a._id} style={styles.row}>
              <Text style={styles.cell}>
                {formatDateShort(a.date)} · {a.projectName} · {a.siteName} · {a.status}
                {a.otHours ? ` · OT ${a.otHours}h` : ""}
              </Text>
              <Text style={styles.muted}>{a.status}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.footer}>
          Earnings aggregate attendance snapshots + overtime records. Salary paid/outstanding from settlements.
        </Text>
      </Page>
    </Document>
  );
}
