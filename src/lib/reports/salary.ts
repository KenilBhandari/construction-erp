import { Labour } from "@/models/Labour";
import { Salary } from "@/models/Salary";
import { LabourAdvance } from "@/models/LabourAdvance";
import { Expense } from "@/models/Expense";
import { getBulkAdvanceSummaries, getGlobalAdvanceTotals } from "@/lib/advances";
import { dateMatch, idMatch, type ReportScope } from "@/lib/reports/scope";

export interface SalaryWorkerRow {
  labourId: string;
  name: string;
  /** Σ Salary.net — what was earned in scope. */
  earned: number;
  /** Σ Salary.paidAmount — cash actually paid. */
  paid: number;
  /** Earned − paid. */
  outstanding: number;
}

/**
 * Salary analysis — worker/period based ONLY. Salary.site/project is
 * attribution-only display and is never used for project/site slicing.
 * Scope dates match settlements whose period overlaps the range.
 */
export async function getSalaryAnalysis(
  scope?: Pick<ReportScope, "from" | "to"> & { labourId?: string },
): Promise<SalaryWorkerRow[]> {
  const dm = dateMatch(scope) as { date?: { $gte: Date; $lte: Date } };
  const periodMatch =
    scope?.from || scope?.to
      ? { periodStart: { $lte: dm.date?.$lte }, periodEnd: { $gte: dm.date?.$gte } }
      : {};
  const rows = await Salary.aggregate([
    { $match: { ...periodMatch, ...idMatch("labour", scope?.labourId) } },
    {
      $group: {
        _id: "$labour",
        earned: { $sum: "$net" },
        paid: { $sum: "$paidAmount" },
      },
    },
    {
      $lookup: { from: Labour.collection.name, localField: "_id", foreignField: "_id", as: "lab" },
    },
    { $unwind: { path: "$lab", preserveNullAndEmptyArrays: true } },
    { $sort: { earned: -1 } },
  ]);
  return (
    rows as Array<{ _id: { toString(): string }; earned: number; paid: number; lab?: { name?: string } }>
  ).map((r) => ({
    labourId: String(r._id),
    name: r.lab?.name ?? "—",
    earned: r.earned ?? 0,
    paid: r.paid ?? 0,
    outstanding: (r.earned ?? 0) - (r.paid ?? 0),
  }));
}

export interface AdvanceWorkerRow {
  labourId: string;
  name: string;
  /** Given in scope (or lifetime when unscoped). */
  given: number;
  /** Lifetime recovered — recovery is explicit per settlement, not date-attributable. */
  recovered: number;
  /** Lifetime written off. */
  writtenOff: number;
  /** Lifetime outstanding = Given − Recovered − Written Off (canonical formula). */
  outstanding: number;
}

export interface AdvanceReport {
  rows: AdvanceWorkerRow[];
  totals: { given: number; recovered: number; writtenOff: number; outstanding: number };
}

/**
 * Advance analysis — outstanding money with workers. Outstanding belongs to the
 * labour, not a site/project (attribution only), so no project/site filter.
 */
export async function getAdvanceReport(scope?: Pick<ReportScope, "from" | "to">): Promise<AdvanceReport> {
  const dm = dateMatch(scope) as { date?: { $gte: Date; $lte: Date } };
  const scoped = scope?.from || scope?.to;
  if (!scoped) {
    const [labours, totals] = await Promise.all([
      Labour.find({}).select("name").sort({ name: 1 }).lean(),
      getGlobalAdvanceTotals(),
    ]);
    const summaries = await getBulkAdvanceSummaries(labours.map((l) => String(l._id)));
    const rows: AdvanceWorkerRow[] = [];
    for (const l of labours) {
      const s = summaries.get(String(l._id));
      if (!s || (s.totalGiven === 0 && s.outstanding === 0)) continue;
      rows.push({
        labourId: String(l._id),
        name: (l.name as string) ?? "—",
        given: s.totalGiven,
        recovered: s.totalRecovered,
        writtenOff: s.totalWrittenOff,
        outstanding: s.outstanding,
      });
    }
    return {
      rows: rows.sort((a, b) => b.outstanding - a.outstanding),
      totals: {
        given: totals.totalGiven,
        recovered: totals.totalRecovered,
        writtenOff: totals.totalWrittenOff,
        outstanding: totals.outstanding,
      },
    };
  }
  // Date-scoped: given-in-period per worker + lifetime recovery position each.
  // Recovery/write-off are explicit per settlement — not date-attributable, so
  // rows pair period activity with the lifetime outstanding they affect.
  const givenRows = (await LabourAdvance.aggregate([
    { $match: dm },
    { $group: { _id: "$labour", given: { $sum: "$amount" } } },
    {
      $lookup: { from: Labour.collection.name, localField: "_id", foreignField: "_id", as: "lab" },
    },
    { $unwind: { path: "$lab", preserveNullAndEmptyArrays: true } },
    { $sort: { given: -1 } },
  ])) as Array<{ _id: { toString(): string }; given: number; lab?: { name?: string } }>;
  const summaries = await getBulkAdvanceSummaries(givenRows.map((r) => String(r._id)));
  const rows: AdvanceWorkerRow[] = givenRows.map((r) => {
    const s = summaries.get(String(r._id));
    return {
      labourId: String(r._id),
      name: r.lab?.name ?? "—",
      given: r.given,
      recovered: s?.totalRecovered ?? 0,
      writtenOff: s?.totalWrittenOff ?? 0,
      outstanding: s?.outstanding ?? 0,
    };
  });
  const totals = await getGlobalAdvanceTotals();
  return {
    rows,
    totals: {
      given: rows.reduce((sum, r) => sum + r.given, 0),
      recovered: totals.totalRecovered,
      writtenOff: totals.totalWrittenOff,
      outstanding: totals.outstanding,
    },
  };
}
