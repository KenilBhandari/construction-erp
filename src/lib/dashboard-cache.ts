// Dashboard cache: intentionally simpler than the Phase-2 list cache.
//
// Mutation-driven invalidation, NOT time-driven revalidation. There is no
// TTL and no background revalidation for the dashboard:
//
//   CLEAN + same UTC day + cached -> serve cache, zero network requests.
//   DIRTY                          -> blocking fresh fetch (dirty clears
//                                     only after the fetch succeeds).
//   NO CACHE (first visit / reload) -> blocking fresh fetch.
//   NEW UTC DAY                    -> blocking fresh fetch (yesterday's
//                                     today.* / unmarkedToday must never
//                                     be reused).
//
// Memory-only (never localStorage): a full page reload starts with no
// cache, so the dashboard fetches normally. A single entry holds the full
// DashboardSummary — per-project finance is NOT cached separately, so
// invalidation stays a single dirty flag.

import type { MutationDomain } from "@/lib/cache-tags";
import type { DashboardSummary } from "@/lib/dashboard";

export interface DashboardEntry {
  /** UTC day (yyyy-mm-dd) the entry was fetched on. */
  dayKey: string;
  data: DashboardSummary;
}

/**
 * Every mutation domain dirties the dashboard. Dashboard aggregates span
 * all collections (attendance/OT move today's ops + labour cost, salary
 * moves pending payments, advances/write-offs move recent activity), so
 * any write anywhere must force the next dashboard visit to refetch.
 */
export const DASHBOARD_DIRTY_DOMAINS: ReadonlySet<MutationDomain> = new Set<MutationDomain>([
  "projects",
  "sites",
  "labour",
  "assignments",
  "attendance",
  "overtime",
  "stock",
  "materials",
  "expenses",
  "payments",
  "advances",
  "salary",
]);

export function dashboardDirtiedBy(domain: MutationDomain): boolean {
  return DASHBOARD_DIRTY_DOMAINS.has(domain);
}

/** Current UTC date as yyyy-mm-dd. Calculated on the client at read time. */
export function todayKeyUTC(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export type DashboardDecision = "cache" | "fetch";

/**
 * Pure read decision for the dashboard entry.
 * - dirty / missing / fetched on a previous UTC day -> "fetch"
 * - clean + cached + same day -> "cache" (zero network)
 */
export function decideDashboardRead(args: {
  hasEntry: boolean;
  sameDay: boolean;
  dirty: boolean;
}): DashboardDecision {
  if (args.dirty || !args.hasEntry || !args.sameDay) return "fetch";
  return "cache";
}

/**
 * Rehydrate a DashboardSummary received as JSON (dates arrive as ISO
 * strings) back into Date instances. Idempotent: passing an already-
 * revived summary returns an equal copy. Fields consumed as Dates by
 * the dashboard UI: today.date, recentActivity[].at/eventDate.
 */
export function reviveDashboardSummary(raw: DashboardSummary): DashboardSummary {
  return {
    ...raw,
    today: {
      ...raw.today,
      date: new Date(raw.today.date),
    },
    recentActivity: raw.recentActivity.map((a) => ({
      ...a,
      at: new Date(a.at),
      eventDate: a.eventDate ? new Date(a.eventDate) : undefined,
    })),
  };
}
