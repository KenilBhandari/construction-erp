import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth } from "@/lib/api";
import { getDashboardSummary } from "@/lib/dashboard";

/**
 * Full dashboard summary as JSON. Read-only: aggregation logic lives in
 * getDashboardSummary() and is unchanged. Consumed once per session (plus
 * once per mutation) by the client-side dashboard cache — see
 * src/lib/dashboard-cache.ts. Memory-only on the client, never persisted.
 */
export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    await connectDB();
    return ok(await getDashboardSummary());
  } catch (err) {
    return fail(err);
  }
}
