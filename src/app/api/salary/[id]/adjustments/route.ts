import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth } from "@/lib/api";
import { objectIdSchema } from "@/lib/validation";
import { SalaryAdjustment } from "@/models/SalaryAdjustment";

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
    const adjustments = await SalaryAdjustment.find({ salary: id })
      .sort({ createdAt: -1 })
      .lean();
    return ok({ adjustments });
  } catch (err) {
    return fail(err);
  }
}
