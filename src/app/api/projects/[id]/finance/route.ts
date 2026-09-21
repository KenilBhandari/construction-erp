import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth } from "@/lib/api";
import { objectIdSchema } from "@/lib/validation";
import { getProjectFinance } from "@/lib/finance";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const { id } = await params;
    objectIdSchema.parse(id);
    await connectDB();
    return ok(await getProjectFinance(id));
  } catch (err) {
    return fail(err);
  }
}
