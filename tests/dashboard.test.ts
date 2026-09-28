import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Labour } from "@/models/Labour";
import { Attendance } from "@/models/Attendance";
import { LabourAdvance } from "@/models/LabourAdvance";
import { Expense } from "@/models/Expense";
import { Project } from "@/models/Project";
import { Site } from "@/models/Site";
import { formatCompactINR, toDayDate } from "@/lib/utils";
import { getDashboardSummary } from "@/lib/dashboard";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Promise.all(
    [Labour, Attendance, LabourAdvance, Expense, Project, Site].map((m) => m.deleteMany({})),
  );
});

function todayKey(): string {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

describe("formatCompactINR", () => {
  it("compacts lakhs/crores/thousands", () => {
    expect(formatCompactINR(5053343)).toBe("₹50.53L");
    expect(formatCompactINR(8284118)).toBe("₹82.84L");
    expect(formatCompactINR(29800)).toBe("₹29.8K");
    expect(formatCompactINR(25000000)).toBe("₹2.5Cr");
    expect(formatCompactINR(0)).toBe("₹0");
    expect(formatCompactINR(-5000)).toBe("-₹5K");
    expect(formatCompactINR(NaN)).toBe("—");
  });
});

describe("dashboard summary — attention + activity wording", () => {
  it("unmarked = active − marked today; write-off never leaks raw category", async () => {
    const w1 = await Labour.create({ name: "A", phone: "1", skill: "Mason", dailyRate: 600, status: "active" });
    const w2 = await Labour.create({ name: "B", phone: "2", skill: "Helper", dailyRate: 400, status: "active" });
    await Attendance.create({
      labour: w1._id, date: toDayDate(todayKey()), status: "present",
      dailyRateSnapshot: 600, cost: 600,
    });
    await LabourAdvance.create({ labour: w2._id, date: toDayDate(todayKey()), amount: 5000, paymentMethod: "Cash" });
    await Expense.create({
      labour: w2._id, date: toDayDate(todayKey()), category: "WRITE_OFF",
      description: "wo", amount: 1000,
    });

    const s = await getDashboardSummary();
    expect(s.unmarkedToday).toBe(1);
    expect(s.today.present).toBe(1);

    const wo = s.recentActivity.find((a) => a.kind === "expense");
    expect(wo).toBeDefined();
    expect(wo!.text).toContain("Labour advance written off");
    expect(wo!.text).not.toContain("WRITE_OFF");

    const att = s.recentActivity.find((a) => a.kind === "attendance");
    expect(att?.eventDate).toBeDefined();
    // Same-day marking carries no redundant "for <date>" suffix data.
    expect(att?.text).not.toMatch(/· \d/);
  });
});
