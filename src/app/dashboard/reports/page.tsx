import Link from "next/link";
import { connectDB } from "@/lib/mongodb";
import { formatINR } from "@/lib/utils";
import {
  getExpenseReport,
  getLabourReport,
  getProjectFinancialReport,
  getStockReport,
} from "@/lib/dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";

/** Useful, not decorative: financial, labour, expense and stock summaries. */
export default async function ReportsPage() {
  await connectDB();
  const [projects, labour, expenses, stock] = await Promise.all([
    getProjectFinancialReport(),
    getLabourReport(),
    getExpenseReport(),
    getStockReport(),
  ]);

  const maxMonth = Math.max(1, ...expenses.monthly.map((m) => m.amount));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reports"
        description="Project finances, labour, expenses and stock — derived from live records."
      />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text">Project Financials</h2>
        {projects.length === 0 ? (
          <p className="text-sm text-text-muted">No projects yet.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Project</TH>
                <TH numeric>Contract</TH>
                <TH numeric>Budget</TH>
                <TH numeric>Expense</TH>
                <TH numeric>Received</TH>
                <TH numeric>Pending</TH>
                <TH numeric>Profit</TH>
              </TR>
            </THead>
            <tbody>
              {projects.map((p) => (
                <TR key={p._id}>
                  <TD>
                    <Link href={`/dashboard/projects/${p._id}`} className="font-medium text-primary hover:underline">
                      {p.name}
                    </Link>
                    <p className="text-xs text-text-muted">{p.clientName} · {p.status}</p>
                  </TD>
                  <TD numeric>{formatINR(p.contractValue)}</TD>
                  <TD numeric>{formatINR(p.budget)}</TD>
                  <TD numeric>{formatINR(p.expense)}</TD>
                  <TD numeric>{formatINR(p.received)}</TD>
                  <TD numeric>{formatINR(p.pending)}</TD>
                  <TD numeric>{formatINR(p.profit)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text">Labour</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total Workers" value={String(labour.total)} hint={`${labour.active} active`} />
          <StatCard label="Salary Payable" value={formatINR(labour.payable)} hint="Across calculated periods" />
          <StatCard label="Salary Paid" value={formatINR(labour.paid)} hint="Recorded payments" />
          <StatCard label="Salary Balance" value={formatINR(labour.balance)} hint="Payable − paid" />
        </div>
        {labour.bySkill.length > 0 && (
          <Card className="p-5">
            <h3 className="text-base font-semibold text-text">Workers by skill</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {labour.bySkill.map((s) => (
                <Badge key={s.skill} tone="neutral">
                  {s.skill} · {s.count}
                </Badge>
              ))}
            </div>
          </Card>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text">Expenses</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h3 className="text-base font-semibold text-text">By category (manual expenses)</h3>
            {expenses.byCategory.length === 0 ? (
              <p className="mt-2 text-sm text-text-muted">No manual expenses yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {expenses.byCategory.map((c) => (
                  <li key={c.category} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="text-text">{c.category}</span>
                    <span className="tnum font-medium">{formatINR(c.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="p-5">
            <h3 className="text-base font-semibold text-text">By project (manual expenses)</h3>
            {expenses.byProject.length === 0 ? (
              <p className="mt-2 text-sm text-text-muted">No manual expenses yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {expenses.byProject.map((p) => (
                  <li key={p.project} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="text-text">{p.project}</span>
                    <span className="tnum font-medium">{formatINR(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card className="p-5">
          <h3 className="text-base font-semibold text-text">Monthly trend (expenses + purchases)</h3>
          <div className="mt-3 flex h-28 items-end gap-2">
            {expenses.monthly.map((m) => (
              <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-sm bg-primary"
                  style={{ height: `${Math.max(4, Math.round((m.amount / maxMonth) * 96))}px` }}
                  title={`${m.month}: ${formatINR(m.amount)}`}
                />
                <span className="text-[10px] text-text-muted">{m.month}</span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-text">Stock</h2>
          {stock.lowCount > 0 && <Badge tone="warning">{stock.lowCount} low</Badge>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Purchased (30d qty)" value={String(stock.last30Days.purchased)} hint="Sum of quantities" />
          <StatCard label="Consumed (30d qty)" value={String(stock.last30Days.consumed)} hint="Sum of quantities" />
        </div>
        {stock.materials.length > 0 && (
          <Table>
            <THead>
              <TR>
                <TH>Material</TH>
                <TH numeric>Stock</TH>
                <TH numeric>Min</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <tbody>
              {stock.materials.map((m) => (
                <TR key={m._id}>
                  <TD className="font-medium">{m.name}</TD>
                  <TD numeric>{m.stock} {m.unit}</TD>
                  <TD numeric>{m.min}</TD>
                  <TD>
                    {m.low ? <Badge tone="warning">Low Stock</Badge> : <Badge tone="success">OK</Badge>}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </div>
  );
}
