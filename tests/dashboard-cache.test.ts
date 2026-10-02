import { describe, it, expect } from "vitest";
import {
  DASHBOARD_DIRTY_DOMAINS,
  dashboardDirtiedBy,
  decideDashboardRead,
  reviveDashboardSummary,
  todayKeyUTC,
  type DashboardEntry,
} from "@/lib/dashboard-cache";
import type { DashboardSummary } from "@/lib/dashboard";

describe("dashboard-cache: UTC day key", () => {
  it("formats as yyyy-mm-dd from the client clock", () => {
    expect(todayKeyUTC(new Date("2026-03-15T00:30:00Z"))).toBe("2026-03-15");
    // UTC boundary: late-evening IST is still the same UTC day.
    expect(todayKeyUTC(new Date("2026-03-15T18:30:00+05:30"))).toBe("2026-03-15");
  });

  it("rolls over at UTC midnight", () => {
    expect(todayKeyUTC(new Date("2026-03-15T23:59:59Z"))).toBe("2026-03-15");
    expect(todayKeyUTC(new Date("2026-03-16T00:00:01Z"))).toBe("2026-03-16");
  });
});

describe("dashboard-cache: read decision (mutation-driven, no TTL)", () => {
  it("fetches with no cache (first visit / reload)", () => {
    expect(
      decideDashboardRead({ hasEntry: false, sameDay: false, dirty: false }),
    ).toBe("fetch");
  });

  it("serves cache with zero network when clean + same day", () => {
    expect(
      decideDashboardRead({ hasEntry: true, sameDay: true, dirty: false }),
    ).toBe("cache");
  });

  it("fetches when dirty even with a same-day entry", () => {
    expect(
      decideDashboardRead({ hasEntry: true, sameDay: true, dirty: true }),
    ).toBe("fetch");
  });

  it("never reuses a previous-day entry (today.* must not go stale)", () => {
    expect(
      decideDashboardRead({ hasEntry: true, sameDay: false, dirty: false }),
    ).toBe("fetch");
  });
});

describe("dashboard-cache: every mutation domain dirties the dashboard", () => {
  it("covers projects, sites, labour, assignments, attendance, overtime, stock, materials, expenses, payments, advances, salary", () => {
    for (const domain of [
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
    ] as const) {
      expect(dashboardDirtiedBy(domain)).toBe(true);
    }
    expect(DASHBOARD_DIRTY_DOMAINS.size).toBe(12);
  });
});

describe("dashboard-cache: reviveDashboardSummary", () => {
  function raw(): DashboardSummary {
    return {
      activeProjects: 1,
      activeSites: 1,
      totalLabour: 1,
      activeLabour: 1,
      today: {
        date: "2026-03-15T00:00:00.000Z" as unknown as Date,
        present: 1,
        absent: 0,
        half: 0,
        leave: 0,
        total: 1,
        overtimeHours: 0,
      },
      todayPurchases: 0,
      todayExpenses: 0,
      unmarkedToday: 0,
      pendingLabourPayments: 0,
      monthExpenses: 0,
      receivedTotal: 0,
      outstandingTotal: 0,
      contractsTotal: 0,
      profitTotal: 0,
      recordedCostsTotal: 0,
      labourCostTotal: 0,
      labourCostAssigned: 0,
      labourCostUnassigned: 0,
      labourCostOvertime: 0,
      lowStockCount: 0,
      lowStock: [],
      recentActivity: [
        {
          at: "2026-03-15T10:00:00.000Z" as unknown as Date,
          eventDate: "2026-03-14T00:00:00.000Z" as unknown as Date,
          kind: "attendance",
          text: "x",
        },
      ],
      monthlyExpenses: [],
      projects: [],
    };
  }

  it("rehydrates ISO strings into Dates and is idempotent", () => {
    const once = reviveDashboardSummary(raw());
    expect(once.today.date).toBeInstanceOf(Date);
    expect(once.recentActivity[0].at).toBeInstanceOf(Date);
    expect(once.recentActivity[0].eventDate).toBeInstanceOf(Date);

    const twice = reviveDashboardSummary(once);
    expect(twice.today.date.toISOString()).toBe("2026-03-15T00:00:00.000Z");
    expect(twice.recentActivity[0].at.toISOString()).toBe(
      "2026-03-15T10:00:00.000Z",
    );
  });

  it("keeps entries comparable by day key", () => {
    const entry: DashboardEntry = {
      dayKey: todayKeyUTC(new Date("2026-03-15T10:00:00Z")),
      data: reviveDashboardSummary(raw()),
    };
    expect(entry.dayKey).toBe("2026-03-15");
    expect(
      decideDashboardRead({
        hasEntry: true,
        sameDay: entry.dayKey === todayKeyUTC(new Date("2026-03-15T20:00:00Z")),
        dirty: false,
      }),
    ).toBe("cache");
    expect(
      decideDashboardRead({
        hasEntry: true,
        sameDay: entry.dayKey === todayKeyUTC(new Date("2026-03-16T01:00:00Z")),
        dirty: false,
      }),
    ).toBe("fetch");
  });
});
