import { Types } from "mongoose";
import { LabourAdvance } from "@/models/LabourAdvance";
import { Salary } from "@/models/Salary";
import { Expense } from "@/models/Expense";

/**
 * Labour advance financial summary — single source of truth for outstanding.
 *
 *   outstanding = totalGiven - totalRecovered - totalWrittenOff
 *
 * All figures derived from source transactions:
 *  - LabourAdvance.amount           (money actually given)
 *  - Salary.advanceRecovery         (explicit recovery per settlement)
 *  - Expense LABOUR_ADVANCE_WRITE_OFF (unrecoverable → expense)
 *
 * Outstanding belongs to the labour, not a site/project. Site/project on
 * advances/expenses is attribution only.
 */

export interface LabourAdvanceSummary {
  labour: string;
  totalGiven: number;
  totalRecovered: number;
  totalWrittenOff: number;
  outstanding: number;
}

function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) throw new Error("Invalid labour id.");
  return new Types.ObjectId(id);
}

export async function getLabourAdvanceSummary(labourId: string): Promise<LabourAdvanceSummary> {
  const pid = toObjectId(labourId);

  const [givenAgg, recoveredAgg, writtenOffAgg] = await Promise.all([
    LabourAdvance.aggregate([
      { $match: { labour: pid } },
      { $group: { _id: null, amount: { $sum: "$amount" } } },
    ]),
    Salary.aggregate([
      { $match: { labour: pid } },
      {
        $group: {
          _id: null,
          amount: { $sum: "$advanceRecovery" },
        },
      },
    ]),
    Expense.aggregate([
      { $match: { labour: pid, category: "LABOUR_ADVANCE_WRITE_OFF" } },
      { $group: { _id: null, amount: { $sum: "$amount" } } },
    ]),
  ]);

  const totalGiven = (givenAgg[0] as { amount?: number } | undefined)?.amount ?? 0;
  const totalRecovered = (recoveredAgg[0] as { amount?: number } | undefined)?.amount ?? 0;
  const totalWrittenOff = (writtenOffAgg[0] as { amount?: number } | undefined)?.amount ?? 0;
  const outstanding = totalGiven - totalRecovered - totalWrittenOff;

  return {
    labour: labourId,
    totalGiven,
    totalRecovered,
    totalWrittenOff,
    outstanding,
  };
}

/** Convenience: just the outstanding amount. */
export async function getOutstandingAdvance(labourId: string): Promise<number> {
  const s = await getLabourAdvanceSummary(labourId);
  return s.outstanding;
}

/**
 * Bulk summaries for many labours in 3 queries (not N*3).
 * Useful for lists/reports without re-seeding per-row aggregates.
 */
export async function getBulkAdvanceSummaries(
  labourIds: string[],
): Promise<Map<string, LabourAdvanceSummary>> {
  const unique = [...new Set(labourIds.filter((id) => Types.ObjectId.isValid(id)))];
  if (unique.length === 0) return new Map();
  const oids = unique.map((id) => new Types.ObjectId(id));

  const [givenRows, recoveredRows, writtenOffRows] = await Promise.all([
    LabourAdvance.aggregate([
      { $match: { labour: { $in: oids } } },
      { $group: { _id: "$labour", amount: { $sum: "$amount" } } },
    ]),
    Salary.aggregate([
      { $match: { labour: { $in: oids } } },
      {
        $group: {
          _id: "$labour",
          amount: { $sum: "$advanceRecovery" },
        },
      },
    ]),
    Expense.aggregate([
      { $match: { labour: { $in: oids }, category: "LABOUR_ADVANCE_WRITE_OFF" } },
      { $group: { _id: "$labour", amount: { $sum: "$amount" } } },
    ]),
  ]);

  const givenMap = new Map<string, number>();
  for (const r of givenRows as { _id: Types.ObjectId; amount: number }[]) {
    givenMap.set(String(r._id), r.amount);
  }
  const recoveredMap = new Map<string, number>();
  for (const r of recoveredRows as { _id: Types.ObjectId; amount: number }[]) {
    recoveredMap.set(String(r._id), r.amount);
  }
  const writtenMap = new Map<string, number>();
  for (const r of writtenOffRows as { _id: Types.ObjectId; amount: number }[]) {
    writtenMap.set(String(r._id), r.amount);
  }

  const out = new Map<string, LabourAdvanceSummary>();
  for (const id of unique) {
    const totalGiven = givenMap.get(id) ?? 0;
    const totalRecovered = recoveredMap.get(id) ?? 0;
    const totalWrittenOff = writtenMap.get(id) ?? 0;
    out.set(id, {
      labour: id,
      totalGiven,
      totalRecovered,
      totalWrittenOff,
      outstanding: totalGiven - totalRecovered - totalWrittenOff,
    });
  }
  return out;
}

/** Global totals across all labour — for reporting header. */
export async function getGlobalAdvanceTotals(): Promise<Omit<LabourAdvanceSummary, "labour">> {
  const [givenAgg, recoveredAgg, writtenOffAgg] = await Promise.all([
    LabourAdvance.aggregate([{ $group: { _id: null, amount: { $sum: "$amount" } } }]),
    Salary.aggregate([
      {
        $group: {
          _id: null,
          amount: { $sum: "$advanceRecovery" },
        },
      },
    ]),
    Expense.aggregate([
      { $match: { category: "LABOUR_ADVANCE_WRITE_OFF" } },
      { $group: { _id: null, amount: { $sum: "$amount" } } },
    ]),
  ]);

  const totalGiven = (givenAgg[0] as { amount?: number } | undefined)?.amount ?? 0;
  const totalRecovered = (recoveredAgg[0] as { amount?: number } | undefined)?.amount ?? 0;
  const totalWrittenOff = (writtenOffAgg[0] as { amount?: number } | undefined)?.amount ?? 0;

  return {
    totalGiven,
    totalRecovered,
    totalWrittenOff,
    outstanding: totalGiven - totalRecovered - totalWrittenOff,
  };
}
