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
      .populate({ path: "earningsBreakdown.site", select: "name", strictPopulate: false })
      .populate({ path: "earningsBreakdown.project", select: "name", strictPopulate: false })
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

    // Lock: only PENDING can be mutated via PATCH; PARTIALLY_PAID/PAID snapshot frozen
    const isLocked = existing.status !== "pending";
    const mutatingFields = body.advanceRecovery !== undefined || body.deductions !== undefined || body.site !== undefined || body.project !== undefined;
    if (isLocked && mutatingFields) {
      return fail(new Error("This settlement has payments and its snapshot is frozen. Create a new settlement or record a payment instead."), 422);
    }

    // Handle site/project attribution with validation (only for pending)
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

    if (body.deductions !== undefined) {
      if (body.deductions < 0) return fail(new Error("Deductions cannot be negative."), 422);
      existing.deductions = body.deductions;
    }
    if (body.paymentMethod !== undefined) existing.paymentMethod = body.paymentMethod ?? null;
    if (body.paymentReference !== undefined) existing.paymentReference = body.paymentReference ?? null;
    if (body.notes !== undefined) existing.notes = body.notes;

    // Recompute net and remaining, guard against net<=0 or over-deduction
    const newNet = existing.gross + existing.overtimeAmount - (existing.advanceRecovery ?? 0) - (existing.deductions ?? 0);
    if (newNet <= 0) return fail(new Error("Advance recovery and deductions cannot make net amount ₹0 or less."), 422);
    if ((existing.advanceRecovery ?? 0) + (existing.deductions ?? 0) > existing.gross + existing.overtimeAmount) {
      return fail(new Error("Recovery and deductions cannot exceed gross + overtime."), 422);
    }
    existing.net = newNet;
    existing.remainingAmount = Math.max(0, newNet - existing.paidAmount);
    existing.status = deriveSalaryStatus(newNet, existing.paidAmount);
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
    const existing = await Salary.findById(id).lean();
    if (!existing) return fail(new Error("Salary record not found."), 404);
    if (existing.status !== "pending") return fail(new Error("Only pending settlements can be deleted. Paid or partially paid records are locked."), 422);
    const deleted = await Salary.findByIdAndDelete(id).lean();
    if (!deleted) return fail(new Error("Salary record not found."), 404);
    const { SalaryPayment } = await import("@/models/SalaryPayment");
    await SalaryPayment.deleteMany({ salarySettlementId: id });
    return ok({ deleted: true });
  } catch (err) {
    return fail(err);
  }
}
