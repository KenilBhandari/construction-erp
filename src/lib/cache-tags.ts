// Single source of truth for cache invalidation.
// Mutation domain -> reference scopes that must be refetched.
// Keeps the "dashboardNeedsRefresh flag" idea generalized without cascading misses.

export type ReferenceScope = "projects" | "sites" | "labour" | "materials";

export type MutationDomain =
  | "projects"
  | "sites"
  | "labour"
  | "attendance"
  | "overtime"
  | "stock"
  | "materials"
  | "expenses"
  | "payments"
  | "advances"
  | "salary"
  | "assignments";

export const REFERENCE_URLS: Record<ReferenceScope, string> = {
  projects: "/api/projects?limit=100",
  sites: "/api/sites?limit=100",
  labour: "/api/labour?limit=100&sort=name",
  materials: "/api/materials?limit=100&sort=name",
};

/** How long reference data is trusted before background revalidation. */
export const REFERENCE_TTL_MS = 5 * 60 * 1000;

/**
 * Minimum entry age before a mount may trigger a background revalidation.
 * Younger + clean entries serve cache-only with zero network requests,
 * so rapid page navigation does not refetch on every mount.
 */
export const REVALIDATE_AFTER_MS = 60 * 1000;

export const DOMAIN_DEPS: Record<MutationDomain, ReferenceScope[]> = {
  projects: ["projects", "sites"],
  sites: ["sites"],
  labour: ["labour"],
  attendance: [],
  overtime: [],
  stock: ["materials"],
  materials: ["materials"],
  expenses: [],
  payments: ["projects"],
  advances: [],
  salary: ["labour"],
  assignments: ["labour", "sites"],
};

/** Expand one mutation into the reference scopes to mark dirty. */
export function scopesForDomain(domain: MutationDomain): ReferenceScope[] {
  return DOMAIN_DEPS[domain] ?? [];
}

/** Expand several mutations at once (deduped). */
export function scopesForDomains(domains: MutationDomain[]): ReferenceScope[] {
  const out = new Set<ReferenceScope>();
  for (const d of domains) {
    for (const s of scopesForDomain(d)) out.add(s);
  }
  return [...out];
}
