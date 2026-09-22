import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth } from "@/lib/api";
import { objectIdSchema } from "@/lib/validation";
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
    const summary = await getLabourAdvanceSummary(id);
    return ok(summary);
  } catch (err) {
    return fail(err);
  }
}
