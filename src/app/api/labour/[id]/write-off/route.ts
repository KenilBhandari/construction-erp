import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth } from "@/lib/api";
import { objectIdSchema } from "@/lib/validation";
import { writeOffCreateSchema } from "@/lib/schemas";
import { toDayDate } from "@/lib/utils";
import { Labour } from "@/models/Labour";
import { LabourAdvance } from "@/models/LabourAdvance";
import { Expense } from "@/models/Expense";
import { Site } from "@/models/Site";
import { Project } from "@/models/Project";
import { getLabourAdvanceSummary } from "@/lib/advances";

async function getId(params: Promise<{ id: string }>) {
  const { id } = await params;
  return objectIdSchema.parse(id);
}

/**
 * POST /api/labour/:id/write-off
 * Creates an Expense with category LABOUR_ADVANCE_WRITE_OFF.
 * Validates amount <= outstanding, derives project from site as in Phase 3.
 * Does not mutate LabourAdvance or Salary.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const labourId = await getId(params);
    const body = writeOffCreateSchema.parse(await req.json());

    await connectDB();

    const labour = await Labour.findById(labourId).lean();
    if (!labour) return fail(new Error("Worker not found."), 404);

    // Validate optional labourAdvance traceability (no allocation logic)
    let labourAdvanceOid: Types.ObjectId | null = null;
    if (body.labourAdvance) {
      const adv = await LabourAdvance.findById(body.labourAdvance).select("labour").lean();
      if (!adv) return fail(new Error("Referenced advance not found."), 404);
      if (String(adv.labour) !== String(labourId)) {
        return fail(new Error("Referenced advance does not belong to this worker."), 422);
      }
      labourAdvanceOid = new Types.ObjectId(body.labourAdvance);
    }

    // Resolve site/project exactly as Phase 3 salary/advance logic
    let siteOid: Types.ObjectId | null = null;
    let projectOid: Types.ObjectId | null = null;

    if (body.site) {
      const siteDoc = await Site.findById(body.site).select("project").lean();
      if (!siteDoc) return fail(new Error("Selected site not found."), 404);
      siteOid = new Types.ObjectId(body.site);
      const siteProjectId = String(siteDoc.project);
      if (body.project && String(body.project) !== siteProjectId) {
        return fail(new Error("Selected project does not match the site's project."), 422);
      }
      projectOid = body.project ? new Types.ObjectId(body.project) : new Types.ObjectId(siteProjectId);
    } else if (body.project) {
      const exists = await Project.exists({ _id: body.project });
      if (!exists) return fail(new Error("Selected project not found."), 404);
      projectOid = new Types.ObjectId(body.project);
    }

    // Validate amount against outstanding (cannot go negative)
    const summary = await getLabourAdvanceSummary(labourId);
    if (summary.outstanding <= 0) {
      return fail(
        new Error(`No outstanding advance to write off. Outstanding is ₹${summary.outstanding.toLocaleString("en-IN")} (given ₹${summary.totalGiven.toLocaleString("en-IN")} − recovered ₹${summary.totalRecovered.toLocaleString("en-IN")} − written off ₹${summary.totalWrittenOff.toLocaleString("en-IN")}).`),
        422,
      );
    }
    if (body.amount > summary.outstanding) {
      return fail(
        new Error(
          `Write-off ₹${body.amount.toLocaleString("en-IN")} exceeds outstanding ₹${summary.outstanding.toLocaleString("en-IN")} (given ₹${summary.totalGiven.toLocaleString("en-IN")} − recovered ₹${summary.totalRecovered.toLocaleString("en-IN")} − written off ₹${summary.totalWrittenOff.toLocaleString("en-IN")}).`,
        ),
        422,
      );
    }

    // expenseType: explicit wins, else PROJECT if project present, else GENERAL — consistent with existing terminology
    const expenseType =
      body.expenseType ?? (projectOid ? "PROJECT" : "GENERAL");

    const expenseDate = body.date ? toDayDate(body.date) : new Date();
    // Ensure date is at UTC midnight like other toDayDate uses
    if (!body.date) {
      expenseDate.setUTCHours(0, 0, 0, 0);
    }

    const description =
      body.description?.trim() ||
      `Advance write-off for ${labour.name}`;

    const created = await Expense.create({
      project: projectOid,
      site: siteOid,
      date: expenseDate,
      category: "LABOUR_ADVANCE_WRITE_OFF",
      description,
      amount: body.amount,
      vendor: null,
      paymentMethod: "Cash",
      reference: null,
      notes: body.notes ?? null,
      expenseType,
      labour: new Types.ObjectId(labourId),
      labourAdvance: labourAdvanceOid,
    });

    // Fresh outstanding after write-off for response convenience
    const after = await getLabourAdvanceSummary(labourId);

    return ok({ expense: created, summary: after }, { status: 201 });
  } catch (err) {
    return fail(err, 422);
  }
}

/** Optional: list write-offs for this labour (useful for UI/history). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;
  try {
    const labourId = await getId(params);
    await connectDB();
    const labour = await Labour.exists({ _id: labourId });
    if (!labour) return fail(new Error("Worker not found."), 404);
    const [data, totals] = await Promise.all([
      Expense.find({ labour: new Types.ObjectId(labourId), category: "LABOUR_ADVANCE_WRITE_OFF" })
        .populate("project", "name")
        .populate("site", "name")
        .sort({ date: -1, createdAt: -1 })
        .lean(),
      Expense.aggregate([
        { $match: { labour: new Types.ObjectId(labourId), category: "LABOUR_ADVANCE_WRITE_OFF" } },
        { $group: { _id: null, amount: { $sum: "$amount" } } },
      ]),
    ]);
    const summary = await getLabourAdvanceSummary(labourId);
    return ok({ data, totalWrittenOff: totals[0]?.amount ?? 0, summary });
  } catch (err) {
    return fail(err);
  }
}
