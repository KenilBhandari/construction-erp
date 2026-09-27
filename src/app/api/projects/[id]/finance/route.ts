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
    const url = new URL(_req.url);
    const from = url.searchParams.get("from")?.trim() || undefined;
    const to = url.searchParams.get("to")?.trim() || undefined;
    const site = url.searchParams.get("site")?.trim() || undefined;
    const scoped = from || to || site ? { from, to, site } : undefined;
    return ok(await getProjectFinance(id, scoped));
  } catch (err) {
    return fail(err);
  }
}
