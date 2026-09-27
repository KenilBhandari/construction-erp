import { Project } from "@/models/Project";
import { ClientPayment } from "@/models/ClientPayment";
import { calculatePendingPayment } from "@/lib/calculations";
import { dateMatch, type ReportScope } from "@/lib/reports/scope";
import { REPORT_PAGE_SIZE, getPaymentRecords, type PaymentRecord } from "@/lib/reports/project-runner";
import { getReceivables } from "@/lib/reports/project";

export interface PaymentRunnerReport {
  header: { projectId: string | null; projectName: string | null };
  /**
   * Contract/outstanding are lifetime figures — null when date-scoped, because
   * a period's received cash cannot be set against a lifetime contract value.
   */
  summary: { contract: number | null; received: number; outstanding: number | null; count: number };
  /** Per-project rows — only when reporting across all projects. */
  byProject: Array<{ projectId: string; name: string; received: number }>;
  history: { rows: PaymentRecord[]; total: number };
  generatedAt: Date;
}

/**
 * Client Payments runner — audit trail of money in.
 * Single project: contract/received/outstanding + history.
 * All projects: totals + per-project split + combined history.
 * Outstanding = Contract − Received. No aging — no due dates exist.
 */
export async function getPaymentRunnerReport(
  scope: Pick<ReportScope, "from" | "to" | "projectId"> & { page?: number; pageSize?: number },
): Promise<PaymentRunnerReport> {
  const dm = dateMatch(scope);
  const dated = Boolean(scope.from || scope.to);
  if (scope.projectId) {
    const project = await Project.findById(scope.projectId).lean();
    if (!project) throw new Error("Project not found.");
    const [agg, history] = await Promise.all([
      ClientPayment.aggregate([
        { $match: { project: project._id, ...dm } },
        { $group: { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      getPaymentRecords(scope, scope.page ?? 1, scope.pageSize ?? REPORT_PAGE_SIZE),
    ]);
    const received = agg[0]?.amount ?? 0;
    const contract = project.contractValue as number;
    return {
      header: { projectId: scope.projectId, projectName: project.name as string },
      summary: {
        contract: dated ? null : contract,
        received,
        outstanding: dated ? null : calculatePendingPayment(contract, received),
        count: agg[0]?.count ?? 0,
      },
      byProject: [],
      history,
      generatedAt: new Date(),
    };
  }
  const [projects, receivedAgg, history, receivables] = await Promise.all([
    Project.find({}).select("contractValue").lean(),
    ClientPayment.aggregate([
      { $match: dm },
      { $group: { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    getPaymentRecords(scope, scope.page ?? 1, scope.pageSize ?? REPORT_PAGE_SIZE),
    getReceivables({ from: scope.from, to: scope.to }),
  ]);
  const contract = projects.reduce((s, p) => s + ((p.contractValue as number) ?? 0), 0);
  const received = receivedAgg[0]?.amount ?? 0;
  return {
    header: { projectId: null, projectName: null },
    summary: {
      contract: dated ? null : contract,
      received,
      outstanding: dated ? null : contract - received,
      count: receivedAgg[0]?.count ?? 0,
    },
    byProject: receivables.map((r) => ({ projectId: r._id, name: r.name, received: r.received })),
    history,
    generatedAt: new Date(),
  };
}
