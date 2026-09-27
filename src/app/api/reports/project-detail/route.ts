import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth } from "@/lib/api";
import { objectIdSchema } from "@/lib/validation";
import { getProjectFinance } from "@/lib/finance";
import { getSitePerformance } from "@/lib/reports";

/** Drill-down for Project Performance: cost heads + per-site split under one scope. */
export async function GET(req: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    await connectDB();
    const url = new URL(req.url);
    const project = url.searchParams.get("project")?.trim() ?? "";
    const parsed = objectIdSchema.safeParse(project);
    if (!parsed.success) return fail(new Error("Valid project id required."), 422);
    const from = url.searchParams.get("from")?.trim() || undefined;
    const to = url.searchParams.get("to")?.trim() || undefined;
    const [finance, sites] = await Promise.all([
      getProjectFinance(parsed.data, from || to ? { from, to } : undefined),
      getSitePerformance({ projectId: parsed.data, from, to }),
    ]);
    return ok({ finance, sites });
  } catch (err) {
    return fail(err);
  }
}
