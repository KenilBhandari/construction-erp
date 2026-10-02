import { describe, it, expect } from "vitest";
import {
  DOMAIN_DEPS,
  REFERENCE_TTL_MS,
  REFERENCE_URLS,
  REVALIDATE_AFTER_MS,
  scopesForDomain,
  scopesForDomains,
} from "@/lib/cache-tags";

describe("cache-tags: reference invalidation map", () => {
  it("covers every mutation domain", () => {
    expect(Object.keys(DOMAIN_DEPS).sort()).toEqual(
      [
        "projects",
        "sites",
        "labour",
        "attendance",
        "overtime",
        "stock",
        "materials",
        "expenses",
        "payments",
        "advances",
        "salary",
        "assignments",
      ].sort(),
    );
  });

  it("site mutations dirty the shared sites scope", () => {
    expect(scopesForDomain("sites")).toContain("sites");
  });

  it("project mutations dirty projects + site filter options", () => {
    expect(scopesForDomains(["projects"])).toEqual(
      expect.arrayContaining(["projects", "sites"]),
    );
  });

  it("attendance/overtime/expenses never serve stale dropdowns as fresh", () => {
    // These domains have no reference scope: their writes must NOT
    // silently keep a stale dropdown trusted, list pages refetch directly.
    expect(scopesForDomain("attendance")).toEqual([]);
    expect(scopesForDomain("expenses")).toEqual([]);
  });

  it("payments refresh project options (contract hints), salary refreshes labour", () => {
    expect(scopesForDomain("payments")).toContain("projects");
    expect(scopesForDomain("salary")).toContain("labour");
  });

  it("assignments refresh both labour and site options", () => {
    expect(scopesForDomains(["assignments"])).toEqual(
      expect.arrayContaining(["labour", "sites"]),
    );
  });

  it("dedupes scopes across domains", () => {
    expect(scopesForDomains(["sites", "assignments"])).toEqual(["sites", "labour"]);
  });

  it("reference endpoints stay paginated + TTL sane (5 min)", () => {
    for (const url of Object.values(REFERENCE_URLS)) {
      expect(url).toMatch(/limit=100/);
    }
    expect(REFERENCE_TTL_MS).toBe(5 * 60 * 1000);
  });

  it("throttles background revalidation inside the TTL window", () => {
    expect(REVALIDATE_AFTER_MS).toBe(60 * 1000);
    expect(REVALIDATE_AFTER_MS).toBeLessThan(REFERENCE_TTL_MS);
  });
});
