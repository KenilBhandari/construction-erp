import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth } from "@/lib/api";
import { objectIdSchema } from "@/lib/validation";
import { paymentUpdateSchema } from "@/lib/schemas";
import { toDayDate } from "@/lib/utils";
import { ClientPayment } from "@/models/ClientPayment";

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
    const payment = await ClientPayment.findById(id)
      .populate("project", "name clientName")
      .lean();
    if (!payment) return fail(new Error("Payment not found."), 404);
    return ok(payment);
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
    // Payments stay on their project — only details change.
    const body = paymentUpdateSchema.parse(await req.json());
    const updated = await ClientPayment.findByIdAndUpdate(
      id,
      {
        ...body,
        ...(body.date !== undefined ? { date: toDayDate(body.date) } : {}),
      },
      { new: true, runValidators: true },
    ).lean();
    if (!updated) return fail(new Error("Payment not found."), 404);
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
    const deleted = await ClientPayment.findByIdAndDelete(id).lean();
    if (!deleted) return fail(new Error("Payment not found."), 404);
    return ok({ deleted: true });
  } catch (err) {
    return fail(err);
  }
}
