// Page-1 list cache: default-view list responses (page 1, no filters,
// default sort) shared across navigations within the session.
//
// Deliberately NOT cached: filtered views, pages 2+, salary tabs (money),
// attendance roster (date-scoped, always fresh), reports, dashboard,
// low-stock alerts. Those always fetch.
//
// Memory-only (never localStorage): list totals shift often and must not
// survive a reload. Reference dropdowns stay in cache-tags.ts + LS.

import type { MutationDomain } from "@/lib/cache-tags";

export type ListScope =
  | "projects"
  | "sites"
  | "labour"
  | "materials"
  | "stock"
  | "purchases"
  | "expenses"
  | "payments"
  | "overtime";

/** Lists change faster than reference data: trusted for 60s. */
export const LIST_TTL_MS = 60 * 1000;

/**
 * Minimum entry age before a mount may background-revalidate.
 * Younger + clean entries serve cache-only with zero network requests.
 */
export const LIST_REVALIDATE_AFTER_MS = 30 * 1000;

/**
 * Mutation domain -> default-view lists that must refetch.
 * Includes cross-domain name displays: e.g. a site rename is visible in
 * labour / stock / expenses / overtime lists, so those dirty too.
 * Salary / advances / attendance have no cached list dependents.
 */
export const LIST_DEPS: Record<MutationDomain, ListScope[]> = {
  projects: ["projects", "sites", "payments"],
  sites: ["sites", "labour", "stock", "purchases", "expenses", "overtime"],
  labour: ["labour", "overtime"],
  assignments: ["labour"],
  stock: ["stock", "purchases", "materials"],
  materials: ["materials"],
  expenses: ["expenses"],
  payments: ["payments"],
  overtime: ["overtime"],
  attendance: [],
  advances: [],
  salary: [],
};

export function listScopesForDomain(domain: MutationDomain): ListScope[] {
  return LIST_DEPS[domain] ?? [];
}

export function listScopesForDomains(domains: MutationDomain[]): ListScope[] {
  const out = new Set<ListScope>();
  for (const d of domains) {
    for (const s of listScopesForDomain(d)) out.add(s);
  }
  return [...out];
}

export type ListDecision = "cache-only" | "revalidate" | "fetch";

/**
 * Pure cache decision for a default-view list entry.
 * - dirty / missing / older than TTL -> "fetch" (blocking, spinner)
 * - clean + younger than revalidate-after -> "cache-only" (zero network)
 * - clean + due for revalidation -> "revalidate" (paint cache, fetch quietly)
 */
export function decideListRead(args: {
  ageMs: number | null;
  dirty: boolean;
  ttlMs?: number;
  revalidateAfterMs?: number;
}): ListDecision {
  const ttl = args.ttlMs ?? LIST_TTL_MS;
  const revalidateAfter = args.revalidateAfterMs ?? LIST_REVALIDATE_AFTER_MS;
  if (args.dirty || args.ageMs === null || args.ageMs > ttl) return "fetch";
  if (args.ageMs < revalidateAfter) return "cache-only";
  return "revalidate";
}
