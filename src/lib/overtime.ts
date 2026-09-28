import { Types } from "mongoose";
import { Overtime } from "@/models/Overtime";
import { Labour } from "@/models/Labour";
import { Site } from "@/models/Site";
import { toDayDate } from "@/lib/utils";
import { calculateOvertimeAmount } from "@/lib/calculations";
import { recomputeSalariesFor, handleAttendanceChangeForReconciliation } from "@/lib/salary";

export interface OvertimeInput {
  labour: string;
  site: string;
  date: string;
  hours: number;
  rate?: number | null;
  notes?: string | null;
  idempotencyKey?: string;
}

async function refreshSalary(labourId: string, date: Date): Promise<void> {
  try {
    await recomputeSalariesFor([labourId], date);
    await handleAttendanceChangeForReconciliation([labourId], date);
  } catch (err) {
    console.warn("[overtime] salary recompute skipped:", (err as Error).message);
  }
}

async function resolveContext(labourId: string, siteId: string) {
  if (!Types.ObjectId.isValid(labourId)) throw new Error("Invalid worker id.");
  if (!Types.ObjectId.isValid(siteId)) throw new Error("Invalid site id.");
  const [labour, site] = await Promise.all([
    Labour.findById(labourId).select("hourlyRate").lean(),
    Site.findById(siteId).select("project").lean(),
  ]);
  if (!labour) throw new Error("Worker not found.");
  if (!site?.project) throw new Error("Selected site not found.");
  return { labour, site };
}

/**
 * Canonical OT creator — the single place overtime records are created.
 * One Overtime doc per labour+day: duplicates are rejected, never overwritten.
 * Edits go through updateOvertime by id.
 */
export async function saveOvertime(input: OvertimeInput) {
  const { labour, site } = await resolveContext(input.labour, input.site);
  const day = toDayDate(input.date);

  if (input.idempotencyKey) {
    const byKey = await Overtime.findOne({ idempotencyKey: input.idempotencyKey }).lean();
    if (byKey) return { record: byKey, created: false };
  }

  const existing = await Overtime.findOne({
    labour: new Types.ObjectId(input.labour),
    date: day,
  });
  if (existing) {
    throw new Error("Overtime already exists for this worker on this date. Edit the existing record instead.");
  }

  const rate = input.rate ?? labour.hourlyRate;
  const amount = Math.round(calculateOvertimeAmount(input.hours, rate));
  try {
    const created = await Overtime.create({
      labour: new Types.ObjectId(input.labour),
      site: new Types.ObjectId(input.site),
      project: site.project,
      date: day,
      hours: input.hours,
      rate,
      amount,
      notes: input.notes ?? null,
      idempotencyKey: input.idempotencyKey ?? undefined,
    });
    await refreshSalary(input.labour, day);
    return { record: created.toObject(), created: true };
  } catch (e: unknown) {
    const code = (e as { code?: number })?.code;
    const msg = (e as { message?: string })?.message ?? "";
    if (code === 11000 || msg.includes("duplicate key") || msg.includes("E11000")) {
      if (input.idempotencyKey) {
        const again = await Overtime.findOne({ idempotencyKey: input.idempotencyKey }).lean();
        if (again) return { record: again, created: false };
      }
      throw new Error("Overtime already exists for this worker on this date. Edit the existing record instead.");
    }
    throw e;
  }
}

/** Canonical by-id OT editor — amount recompute + salary refresh in one place. */
export async function updateOvertime(
  id: string,
  patch: { hours?: number; rate?: number; site?: string; notes?: string | null; idempotencyKey?: string },
) {
  if (!Types.ObjectId.isValid(id)) throw new Error("Invalid overtime id.");
  if (patch.idempotencyKey) {
    const byKey = await Overtime.findOne({ idempotencyKey: patch.idempotencyKey }).lean();
    if (byKey) return byKey;
  }
  const existing = await Overtime.findById(id);
  if (!existing) throw new Error("Overtime record not found.");
  if (patch.hours !== undefined) existing.hours = patch.hours;
  if (patch.rate !== undefined) existing.rate = patch.rate;
  if (patch.hours !== undefined || patch.rate !== undefined) {
    existing.amount = Math.round(calculateOvertimeAmount(existing.hours, existing.rate));
  }
  if (patch.site !== undefined) {
    const siteDoc = await Site.findById(patch.site).select("project").lean();
    if (!siteDoc?.project) throw new Error("Selected site not found.");
    existing.site = patch.site as unknown as typeof existing.site;
    existing.project = siteDoc.project as unknown as typeof existing.project;
  }
  if (patch.notes !== undefined) existing.notes = patch.notes;
  if (patch.idempotencyKey) {
    (existing as unknown as Record<string, unknown>).idempotencyKey = patch.idempotencyKey;
  }
  await existing.save();
  await refreshSalary(String(existing.labour), existing.date);
  return existing.toObject();
}
