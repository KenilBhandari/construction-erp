import path from "path";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import { formatINR, formatDateShort } from "@/lib/utils";
import type { LabourReportDetail } from "@/lib/reports/labour-runner";
import type { MaterialReport } from "@/lib/reports/material-runner";
import type { ExpenseRunnerReport } from "@/lib/reports/expense-runner";
import type { SalaryWorkerRow, AdvanceWorkerRow } from "@/lib/reports/salary";

/**
 * Bundled Noto Sans (OFL) — the built-in Helvetica has no ₹ glyph, so rupee
 * amounts rendered as blank/missing. Local files, no network at render time.
 */
const FONTS_DIR = path.join(process.cwd(), "src", "lib", "reports", "fonts");
Font.register({
  family: "Report",
  fonts: [
    { src: path.join(FONTS_DIR, "NotoSans-Regular.ttf") },
    { src: path.join(FONTS_DIR, "NotoSans-Bold.ttf"), fontWeight: "bold" },
  ],
});

const INK = "#1a1a1a";
const MUTED = "#6b6b6b";
const RULE = "#e2e2e2";
const BAND = "#f4f4f4";

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 56, fontSize: 9, fontFamily: "Report", color: INK },
  title: { fontSize: 17, fontWeight: "bold" },
  subtitle: { fontSize: 9, color: MUTED, marginTop: 3 },
  meta: { fontSize: 8, color: MUTED, marginTop: 8, paddingBottom: 8, borderBottom: `1pt solid ${RULE}` },
  section: { marginTop: 14 },
  sectionTitle: {
    fontSize: 8,
    fontWeight: "bold",
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 5,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  stat: { width: "31.5%", border: `1pt solid ${RULE}`, borderRadius: 3, padding: 7, marginBottom: 6 },
  statLabel: { fontSize: 7, color: MUTED },
  statValue: { fontSize: 11, fontWeight: "bold", marginTop: 2 },
  headRow: {
    flexDirection: "row",
    backgroundColor: BAND,
    borderRadius: 2,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  headCell: { fontSize: 7, fontWeight: "bold", color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 },
  bodyRow: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, borderBottom: `1pt solid ${RULE}` },
  bodyCell: { fontSize: 9 },
  right: { textAlign: "right" },
  empty: { fontSize: 9, color: MUTED, paddingVertical: 6, paddingHorizontal: 6 },
  footer: { position: "absolute", bottom: 28, left: 40, right: 40, fontSize: 7, color: "#999", textAlign: "center" },
});

function periodLabel(from?: string, to?: string): string {
  if (!from && !to) return "Lifetime";
  if (from && to && from === to) return formatDateShort(from);
  return `${from ? formatDateShort(from) : "…"} – ${to ? formatDateShort(to) : "…"}`;
}

function DocHead({ title, sub, from, to, generatedAt }: { title: string; sub: string; from?: string; to?: string; generatedAt: string }) {
  return (
    <View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{sub}</Text>
      <Text style={styles.meta}>
        {periodLabel(from, to)} · Generated {generatedAt}
      </Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
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

function Foot() {
  return (
    <Text
      style={styles.footer}
      render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      fixed
    />
  );
}

const qty = (v: number | null) => (v === null ? "—" : String(v));

export function MaterialsPdf({
  report,
  scope,
}: {
  report: MaterialReport;
  scope: { from?: string; to?: string; generatedAt: string };
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <DocHead
          title={report.header.name}
          sub={`Materials & Stock · ${report.header.unit ?? "No unit"}`}
          from={scope.from}
          to={scope.to}
          generatedAt={scope.generatedAt}
        />
        <Section title="Summary">
          <View style={styles.grid}>
            <Stat label="Opening" value={qty(report.summary.opening)} />
            <Stat label="Purchased" value={String(report.summary.purchased)} />
            <Stat label="Consumed" value={String(report.summary.consumed)} />
            <Stat label="Returned" value={String(report.summary.returned)} />
            <Stat label="Adjustments" value={String(report.summary.adjustments)} />
            <Stat
              label={report.summary.closing === null ? "Current stock" : "Closing"}
              value={String(report.summary.closing ?? report.summary.current)}
            />
          </View>
        </Section>
        <Section title="Monthly movement">
          {report.trend.length === 0 ? (
            <Text style={styles.empty}>No movement in scope.</Text>
          ) : (
            <View>
              <View style={styles.headRow}>
                <Text style={[styles.headCell, { flex: 2 }]}>Month</Text>
                <Text style={[styles.headCell, styles.right, { flex: 1 }]}>Purchased</Text>
                <Text style={[styles.headCell, styles.right, { flex: 1 }]}>Consumed</Text>
              </View>
              {report.trend.map((m) => (
                <View key={m.month} style={styles.bodyRow}>
                  <Text style={[styles.bodyCell, { flex: 2 }]}>{m.month}</Text>
                  <Text style={[styles.bodyCell, styles.right, { flex: 1 }]}>{m.purchased}</Text>
                  <Text style={[styles.bodyCell, styles.right, { flex: 1 }]}>{m.consumed}</Text>
                </View>
              ))}
            </View>
          )}
        </Section>
        <Section title={`Transaction history · ${report.history.total}`}>
          {report.history.rows.length === 0 ? (
            <Text style={styles.empty}>No transactions in scope.</Text>
          ) : (
            <View>
              <View style={styles.headRow}>
                <Text style={[styles.headCell, { flex: 1.4 }]}>Date</Text>
                <Text style={[styles.headCell, { flex: 1.4 }]}>Type</Text>
                <Text style={[styles.headCell, styles.right, { flex: 1 }]}>Qty</Text>
                <Text style={[styles.headCell, { flex: 2 }]}>Site</Text>
              </View>
              {report.history.rows.map((t) => (
                <View key={t._id} style={styles.bodyRow}>
                  <Text style={[styles.bodyCell, { flex: 1.4 }]}>{formatDateShort(t.date)}</Text>
                  <Text style={[styles.bodyCell, { flex: 1.4, textTransform: "capitalize" }]}>{t.type}</Text>
                  <Text style={[styles.bodyCell, styles.right, { flex: 1 }]}>{t.quantity}</Text>
                  <Text style={[styles.bodyCell, { flex: 2 }]}>{t.siteName}</Text>
                </View>
              ))}
            </View>
          )}
        </Section>
        <Foot />
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
        <DocHead
          title="Expenses"
          sub="Expense history and breakdowns"
          from={scope.from}
          to={scope.to}
          generatedAt={scope.generatedAt}
        />
        <Section title="Summary">
          <View style={styles.grid}>
            <Stat label="Total" value={formatINR(report.summary.total)} />
            <Stat label="Entries" value={String(report.summary.count)} />
          </View>
        </Section>
        <Section title="By category">
          {report.byCategory.length === 0 ? (
            <Text style={styles.empty}>No expenses in scope.</Text>
          ) : (
            <View>
              <View style={styles.headRow}>
                <Text style={[styles.headCell, { flex: 2 }]}>Category</Text>
                <Text style={[styles.headCell, styles.right, { flex: 1.4 }]}>Amount</Text>
                <Text style={[styles.headCell, styles.right, { flex: 1 }]}>Share</Text>
              </View>
              {report.byCategory.map((c) => (
                <View key={c.label} style={styles.bodyRow}>
                  <Text style={[styles.bodyCell, { flex: 2 }]}>{c.label}</Text>
                  <Text style={[styles.bodyCell, styles.right, { flex: 1.4 }]}>{formatINR(c.amount)}</Text>
                  <Text style={[styles.bodyCell, styles.right, { flex: 1 }]}>{c.share}%</Text>
                </View>
              ))}
            </View>
          )}
        </Section>
        <Section title="Monthly trend">
          {report.trend.length === 0 ? (
            <Text style={styles.empty}>No expenses in scope.</Text>
          ) : (
            <View>
              <View style={styles.headRow}>
                <Text style={[styles.headCell, { flex: 2 }]}>Month</Text>
                <Text style={[styles.headCell, styles.right, { flex: 1 }]}>Amount</Text>
              </View>
              {report.trend.map((m) => (
                <View key={m.month} style={styles.bodyRow}>
                  <Text style={[styles.bodyCell, { flex: 2 }]}>{m.month}</Text>
                  <Text style={[styles.bodyCell, styles.right, { flex: 1 }]}>{formatINR(m.amount)}</Text>
                </View>
              ))}
            </View>
          )}
        </Section>
        <Section title={`Transaction history · ${report.history.total}`}>
          {report.history.rows.length === 0 ? (
            <Text style={styles.empty}>No expenses in scope.</Text>
          ) : (
            <View>
              <View style={styles.headRow}>
                <Text style={[styles.headCell, { flex: 1.3 }]}>Date</Text>
                <Text style={[styles.headCell, { flex: 1.4 }]}>Project</Text>
                <Text style={[styles.headCell, { flex: 1.2 }]}>Site</Text>
                <Text style={[styles.headCell, { flex: 1.2 }]}>Category</Text>
                <Text style={[styles.headCell, styles.right, { flex: 1.4 }]}>Amount</Text>
              </View>
              {report.history.rows.map((e) => (
                <View key={e._id} style={styles.bodyRow} wrap={false}>
                  <Text style={[styles.bodyCell, { flex: 1.3 }]}>{formatDateShort(e.date)}</Text>
                  <Text style={[styles.bodyCell, { flex: 1.4 }]}>{e.projectName}</Text>
                  <Text style={[styles.bodyCell, { flex: 1.2 }]}>{e.siteName}</Text>
                  <Text style={[styles.bodyCell, { flex: 1.2 }]}>{e.category}</Text>
                  <Text style={[styles.bodyCell, styles.right, { flex: 1.4 }]}>{formatINR(e.amount)}</Text>
                </View>
              ))}
            </View>
          )}
        </Section>
        <Foot />
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
        <DocHead
          title="Salary & Advances"
          sub="Earnings, payments, balances and advances"
          from={scope.from}
          to={scope.to}
          generatedAt={scope.generatedAt}
        />
        <Section title="Salary">
          {salaryRows.length === 0 ? (
            <Text style={styles.empty}>No salary settlements in scope.</Text>
          ) : (
            <View>
              <View style={styles.headRow}>
                <Text style={[styles.headCell, { flex: 2 }]}>Worker</Text>
                <Text style={[styles.headCell, styles.right, { flex: 1.2 }]}>Earned</Text>
                <Text style={[styles.headCell, styles.right, { flex: 1.2 }]}>Paid</Text>
                <Text style={[styles.headCell, styles.right, { flex: 1.2 }]}>Outstanding</Text>
              </View>
              {salaryRows.map((s) => (
                <View key={s.labourId} style={styles.bodyRow}>
                  <Text style={[styles.bodyCell, { flex: 2 }]}>{s.name}</Text>
                  <Text style={[styles.bodyCell, styles.right, { flex: 1.2 }]}>{formatINR(s.earned)}</Text>
                  <Text style={[styles.bodyCell, styles.right, { flex: 1.2 }]}>{formatINR(s.paid)}</Text>
                  <Text style={[styles.bodyCell, styles.right, { flex: 1.2 }]}>{formatINR(s.outstanding)}</Text>
                </View>
              ))}
            </View>
          )}
        </Section>
        <Section title="Advances">
          {advanceRows.length === 0 ? (
            <Text style={styles.empty}>No advances in scope.</Text>
          ) : (
            <View>
              <View style={styles.headRow}>
                <Text style={[styles.headCell, { flex: 2 }]}>Worker</Text>
                <Text style={[styles.headCell, styles.right, { flex: 1 }]}>Given</Text>
                <Text style={[styles.headCell, styles.right, { flex: 1 }]}>Recovered</Text>
                <Text style={[styles.headCell, styles.right, { flex: 1 }]}>Written off</Text>
                <Text style={[styles.headCell, styles.right, { flex: 1 }]}>Due</Text>
              </View>
              {advanceRows.map((a) => (
                <View key={a.labourId} style={styles.bodyRow}>
                  <Text style={[styles.bodyCell, { flex: 2 }]}>{a.name}</Text>
                  <Text style={[styles.bodyCell, styles.right, { flex: 1 }]}>{formatINR(a.given)}</Text>
                  <Text style={[styles.bodyCell, styles.right, { flex: 1 }]}>{formatINR(a.recovered)}</Text>
                  <Text style={[styles.bodyCell, styles.right, { flex: 1 }]}>{formatINR(a.writtenOff)}</Text>
                  <Text style={[styles.bodyCell, styles.right, { flex: 1 }]}>{formatINR(a.outstanding)}</Text>
                </View>
              ))}
            </View>
          )}
        </Section>
        <Foot />
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
        <DocHead
          title={report.header.name}
          sub={`Labour & Attendance · ${report.header.skill}`}
          from={scope.from}
          to={scope.to}
          generatedAt={scope.generatedAt}
        />
        <Section title="Summary">
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
        </Section>
        <Section title={`Attendance history · ${report.history.total}`}>
          {report.history.rows.length === 0 ? (
            <Text style={styles.empty}>No attendance in scope.</Text>
          ) : (
            <View>
              <View style={styles.headRow}>
                <Text style={[styles.headCell, { flex: 1.3 }]}>Date</Text>
                <Text style={[styles.headCell, { flex: 1.6 }]}>Project</Text>
                <Text style={[styles.headCell, { flex: 1.4 }]}>Site</Text>
                <Text style={[styles.headCell, { flex: 1.1 }]}>Status</Text>
                <Text style={[styles.headCell, styles.right, { flex: 0.8 }]}>OT hrs</Text>
              </View>
              {report.history.rows.map((a) => (
                <View key={a._id} style={styles.bodyRow}>
                  <Text style={[styles.bodyCell, { flex: 1.3 }]}>{formatDateShort(a.date)}</Text>
                  <Text style={[styles.bodyCell, { flex: 1.6 }]}>{a.projectName}</Text>
                  <Text style={[styles.bodyCell, { flex: 1.4 }]}>{a.siteName}</Text>
                  <Text style={[styles.bodyCell, { flex: 1.1, textTransform: "capitalize" }]}>{a.status}</Text>
                  <Text style={[styles.bodyCell, styles.right, { flex: 0.8 }]}>
                    {a.otHours ? String(a.otHours) : "—"}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Section>
        <Foot />
      </Page>
    </Document>
  );
}
