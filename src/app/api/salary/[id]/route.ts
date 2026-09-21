import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth } from "@/lib/api";
import { objectIdSchema } from "@/lib/validation";
import { salaryUpdateSchema } from "@/lib/schemas";
import { deriveSalaryStatus } from "@/lib/salary";
import { Salary } from "@/models/Salary";

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
    const record = await Salary.findById(id).populate("labour", "name").lean();
    if (!record) return fail(new Error("Salary record not found."), 404);
    return ok(record);
  } catch (err) {
    return fail(err);
  }
}

/** Record payments / deductions. Net and status are re-derived. */
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

    if (body.paidAmount !== undefined) existing.paidAmount = body.paidAmount;
    if (body.deductions !== undefined) existing.deductions = body.deductions;
    if (body.notes !== undefined) existing.notes = body.notes;
    existing.net =
      existing.gross + existing.overtimeAmount - existing.advances - existing.deductions;
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
