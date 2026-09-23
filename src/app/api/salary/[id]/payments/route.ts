import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth, idempotencyKeyFrom } from "@/lib/api";
import { objectIdSchema } from "@/lib/validation";
import { salaryPaymentCreateSchema } from "@/lib/schemas";
import { toDayDate } from "@/lib/utils";
import { deriveSalaryStatus } from "@/lib/salary";
import { Salary } from "@/models/Salary";
import { SalaryPayment } from "@/models/SalaryPayment";

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
    const salary = await Salary.findById(id).lean();
    if (!salary) return fail(new Error("Salary record not found."), 404);
    const payments = await SalaryPayment.find({ salarySettlementId: id }).sort({ date: 1, createdAt: 1 }).lean();
    return ok({ payments, salary: { paidAmount: salary.paidAmount, remainingAmount: salary.remainingAmount, net: salary.net, status: salary.status } });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAuth();
  if (error) return error;
  try {
    const id = await getId(params);
    await connectDB();
    const body = salaryPaymentCreateSchema.parse(await req.json());
    const headerKey = idempotencyKeyFrom(req);

    if (headerKey) {
      const existing = await SalaryPayment.findOne({ idempotencyKey: headerKey }).lean();
      if (existing) {
        const salary = await Salary.findById(id).lean();
        return ok({ salary, payment: existing, idempotent: true }, { status: 200 });
      }
    }

    const salary = await Salary.findById(id);
    if (!salary) return fail(new Error("Salary record not found."), 404);
    if (salary.status === "paid") return fail(new Error("This salary is already fully paid and locked."), 422);
    const remaining = salary.remainingAmount ?? salary.net - salary.paidAmount;
    if (remaining <= 0) return fail(new Error("No remaining amount to pay."), 422);
    if (body.amount > remaining) return fail(new Error(`Payment ₹${body.amount.toLocaleString("en-IN")} exceeds remaining ₹${remaining.toLocaleString("en-IN")}.`), 422);

    const paymentDate = body.date ? toDayDate(body.date) : new Date(toDayDate(new Date().toISOString().slice(0, 10)));
    const expectedPaid = salary.paidAmount;
    const newPaid = expectedPaid + body.amount;
    if (newPaid > salary.net) return fail(new Error(`Payment would exceed net salary ₹${salary.net.toLocaleString("en-IN")}.`), 422);
    const newRemaining = Math.max(0, salary.net - newPaid);
    const newStatus = deriveSalaryStatus(salary.net, newPaid);

    // Atomic salary update to prevent concurrent overpay (compare-and-swap on paidAmount)
    const updated = await Salary.findOneAndUpdate(
      { _id: salary._id, paidAmount: expectedPaid },
      {
        $set: {
          paidAmount: newPaid,
          remainingAmount: newRemaining,
          status: newStatus,
          paymentMethod: body.paymentMethod ?? salary.paymentMethod,
          paymentReference: body.reference ?? salary.paymentReference,
        },
      },
      { new: true },
    );
    if (!updated) return fail(new Error("Concurrent payment detected — please retry."), 409);

    // Create payment — if idempotency duplicate due to race, handle 11000
    try {
      const payment = await SalaryPayment.create({
        salarySettlementId: salary._id,
        amount: body.amount,
        date: paymentDate,
        paymentMethod: body.paymentMethod ?? "Cash",
        reference: body.reference ?? null,
        notes: body.notes ?? null,
        idempotencyKey: headerKey ?? undefined,
      });
      return ok({ salary: updated.toObject(), payment: payment.toObject() }, { status: 201 });
    } catch (e: unknown) {
      const code = (e as { code?: number })?.code;
      const msg = (e as { message?: string })?.message ?? "";
      if (code === 11000 || msg.includes("duplicate key")) {
        // Compensate: rollback salary CAS (best-effort) — refund paidAmount
        await Salary.findOneAndUpdate(
          { _id: salary._id, paidAmount: newPaid },
          { $set: { paidAmount: expectedPaid, remainingAmount: remaining, status: deriveSalaryStatus(salary.net, expectedPaid) } },
        );
        if (headerKey) {
          const existing = await SalaryPayment.findOne({ idempotencyKey: headerKey }).lean();
          if (existing) return ok({ payment: existing, idempotent: true });
        }
        return fail(new Error("Duplicate payment — already processed."), 409);
      }
      // Payment failed after salary updated — attempt rollback
      await Salary.findOneAndUpdate(
        { _id: salary._id, paidAmount: newPaid },
        { $set: { paidAmount: expectedPaid, remainingAmount: remaining, status: deriveSalaryStatus(salary.net, expectedPaid) } },
      );
      throw e;
    }
  } catch (err) {
    return fail(err, 422);
  }
}
