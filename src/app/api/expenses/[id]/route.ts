import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth } from "@/lib/api";
import { objectIdSchema } from "@/lib/validation";
import { expenseUpdateSchema } from "@/lib/schemas";
import { toDayDate } from "@/lib/utils";
import { Expense } from "@/models/Expense";
import { Project } from "@/models/Project";
import { Site } from "@/models/Site";

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
    const expense = await Expense.findById(id)
      .populate("project", "name")
      .populate("site", "name")
      .lean();
    if (!expense) return fail(new Error("Expense not found."), 404);
    return ok(expense);
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const id = await getId(params);
    await connectDB();
    const body = expenseUpdateSchema.parse(await req.json());
    if (body.project) {
      const exists = await Project.exists({ _id: body.project });
      if (!exists) return fail(new Error("Selected project not found."), 404);
    }
    if (body.site) {
      const exists = await Site.exists({ _id: body.site });
      if (!exists) return fail(new Error("Selected site not found."), 404);
    }
    const updated = await Expense.findByIdAndUpdate(
      id,
      {
        ...body,
        ...(body.date !== undefined ? { date: toDayDate(body.date) } : {}),
      },
      { new: true, runValidators: true },
    ).lean();
    if (!updated) return fail(new Error("Expense not found."), 404);
    return ok(updated);
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
    const deleted = await Expense.findByIdAndDelete(id).lean();
    if (!deleted) return fail(new Error("Expense not found."), 404);
    return ok({ deleted: true });
  } catch (err) {
    return fail(err);
  }
}
