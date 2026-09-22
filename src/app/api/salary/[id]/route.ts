import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth } from "@/lib/api";
import { objectIdSchema } from "@/lib/validation";
import { salaryUpdateSchema } from "@/lib/schemas";
import { deriveSalaryStatus } from "@/lib/salary";
import { Salary } from "@/models/Salary";
import { Site } from "@/models/Site";
import { getLabourAdvanceSummary } from "@/lib/advances";

async function getId(params: Promise<{ id: string }>) {
  const { id } = await params;
  return objectIdSchema.parse(id);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const id = await getId(params);
    await connectDB();
    const record = await Salary.findById(id)
      .populate("labour", "name")
      .populate({ path: "site", select: "name", strictPopulate: false })
      .populate({ path: "project", select: "name", strictPopulate: false })
      .lean();
    if (!record) return fail(new Error("Salary record not found."), 404);
    return ok(record);
  } catch (err) {
    return fail(err);
  }
}

/** Update settlement: explicit recovery, deductions, payments, attribution. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const id = await getId(params);
    await connectDB();
    const body = salaryUpdateSchema.parse(await req.json());
    const existing = await Salary.findById(id);
    if (!existing) return fail(new Error("Salary record not found."), 404);

    // Handle site/project attribution with validation
    if (body.site !== undefined || body.project !== undefined) {
      const siteInput = body.site; // may be null or string
      const projectInput = body.project;

      if (siteInput !== undefined) {
        if (siteInput) {
          const siteDoc = await Site.findById(siteInput).select("project").lean();
          if (!siteDoc) return fail(new Error("Selected site not found."), 404);
          const siteProjectId = String(siteDoc.project);
          if (projectInput && String(projectInput) !== siteProjectId) {
            return fail(new Error("Selected project does not match the site's project."), 422);
          }
          existing.site = new Types.ObjectId(siteInput as string);
          existing.project = new Types.ObjectId(
            (projectInput as string | null | undefined) ?? siteProjectId,
          );
        } else {
          existing.site = null as unknown as Types.ObjectId;
          if (projectInput !== undefined) {
            existing.project = projectInput
              ? new Types.ObjectId(projectInput as string)
              : (null as unknown as Types.ObjectId);
          }
        }
      } else if (projectInput !== undefined) {
        existing.project = projectInput
          ? new Types.ObjectId(projectInput as string)
          : (null as unknown as Types.ObjectId);
      }
    }

    if (body.advanceRecovery !== undefined) {
      if (body.advanceRecovery < 0) return fail(new Error("Advance recovery cannot be negative."), 422);
      const summary = await getLabourAdvanceSummary(String(existing.labour));
      const available = summary.outstanding + (existing.advanceRecovery ?? 0);
      if (body.advanceRecovery > available) {
        return fail(
          new Error(
            `Advance recovery ₹${body.advanceRecovery.toLocaleString("en-IN")} exceeds outstanding ₹${available.toLocaleString("en-IN")}. Outstanding is ₹${summary.outstanding.toLocaleString("en-IN")} (given ₹${summary.totalGiven.toLocaleString("en-IN")} − recovered ₹${summary.totalRecovered.toLocaleString("en-IN")} − written off ₹${summary.totalWrittenOff.toLocaleString("en-IN")}).`,
          ),
          422,
        );
      }
      existing.advanceRecovery = body.advanceRecovery;
    }

    if (body.paidAmount !== undefined) existing.paidAmount = body.paidAmount;
    if (body.deductions !== undefined) existing.deductions = body.deductions;
    if (body.paymentMethod !== undefined) existing.paymentMethod = body.paymentMethod ?? null;
    if (body.paymentReference !== undefined) existing.paymentReference = body.paymentReference ?? null;
    if (body.notes !== undefined) existing.notes = body.notes;

    existing.net =
      existing.gross + existing.overtimeAmount - (existing.advanceRecovery ?? 0) - (existing.deductions ?? 0);
    existing.status = deriveSalaryStatus(existing.net, existing.paidAmount);
    await existing.save();

    return ok(existing.toObject());
  } catch (err) {
    return fail(err, 422);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const id = await getId(params);
    await connectDB();
    const deleted = await Salary.findByIdAndDelete(id).lean();
    if (!deleted) return fail(new Error("Salary record not found."), 404);
    return ok({ deleted: true });
  } catch (err) {
    return fail(err);
  }
}
