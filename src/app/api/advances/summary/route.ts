import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth } from "@/lib/api";
import { objectIdSchema } from "@/lib/validation";
import { getLabourAdvanceSummary, getGlobalAdvanceTotals } from "@/lib/advances";

export async function GET(req: Request) {
  const { error } = await requireAuth();
  if (error) return error;
  try {
    await connectDB();
    const url = new URL(req.url);
    const labour = url.searchParams.get("labour")?.trim() ?? "";
    if (labour) {
      const parsed = objectIdSchema.safeParse(labour);
      if (!parsed.success) return fail(new Error("Invalid labour id."), 422);
      const summary = await getLabourAdvanceSummary(labour);
      return ok(summary);
    }
    const global = await getGlobalAdvanceTotals();
    return ok(global);
  } catch (err) {
    return fail(err);
  }
}
