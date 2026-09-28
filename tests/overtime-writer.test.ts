import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Project } from "@/models/Project";
import { Site } from "@/models/Site";
import { Labour } from "@/models/Labour";
import { Attendance } from "@/models/Attendance";
import { Overtime } from "@/models/Overtime";
import { Salary } from "@/models/Salary";
import { SalaryPayment } from "@/models/SalaryPayment";
import { LabourAdvance } from "@/models/LabourAdvance";
import { Expense } from "@/models/Expense";
import { SalaryAdjustment } from "@/models/SalaryAdjustment";
import { saveOvertime, updateOvertime } from "@/lib/overtime";
import { computeAndSaveSalary } from "@/lib/salary";
import { getLabourReportDetail, getAttendanceAnalysis } from "@/lib/reports";
import { toDayDate } from "@/lib/utils";

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
    [Project, Site, Labour, Attendance, Overtime, Salary, SalaryPayment, LabourAdvance, Expense, SalaryAdjustment].map(
      (m) => m.deleteMany({}),
    ),
  );
});

async function setup() {
  const project = await Project.create({
    name: "P1", clientName: "C", location: "L", budget: 100000, contractValue: 100000, status: "active",
  });
  const site = await Site.create({ name: "S1", project: project._id, status: "active" });
  const labour = await Labour.create({
    name: "Ramesh", phone: "9999999999", skill: "Mason", dailyRate: 600, hourlyRate: 100, status: "active",
  });
  return { project, site, labour };
}

describe("single OT writer + canonical OT hours", () => {
  it("creates via saveOvertime with default hourly rate", async () => {
    const { site, labour } = await setup();
    const { record, created } = await saveOvertime({
      labour: String(labour._id), site: String(site._id), date: "2026-09-10", hours: 2,
    });
    expect(created).toBe(true);
    expect(record.hours).toBe(2);
    expect(record.rate).toBe(100);
    expect(record.amount).toBe(200);
  });

  it("duplicate day is rejected, never overwritten", async () => {
    const { site, labour } = await setup();
    await saveOvertime({ labour: String(labour._id), site: String(site._id), date: "2026-09-10", hours: 2 });
    await expect(
      saveOvertime({ labour: String(labour._id), site: String(site._id), date: "2026-09-10", hours: 3, rate: 120 }),
    ).rejects.toThrow("already exists");
    const kept = await Overtime.findOne({}).lean();
    expect(kept?.hours).toBe(2);
    expect(await Overtime.countDocuments({})).toBe(1);
  });

  it("updateOvertime edits by id with amount recompute", async () => {
    const { site, labour } = await setup();
    const { record } = await saveOvertime({
      labour: String(labour._id), site: String(site._id), date: "2026-09-10", hours: 2,
    });
    const updated = await updateOvertime(String((record as { _id: unknown })._id), { hours: 4 });
    expect(updated.hours).toBe(4);
    expect(updated.amount).toBe(400);
  });

  it("report OT hours sum legacy field + Overtime records, rows match total", async () => {
    const { site, labour } = await setup();
    const lid = String(labour._id);
    await Attendance.create({
      labour: labour._id, site: site._id, project: site.project, date: toDayDate("2026-09-10"),
      status: "present", dailyRateSnapshot: 600, hourlyRateSnapshot: 100, cost: 600, overtimeHours: 4,
    });
    await Attendance.create({
      labour: labour._id, site: site._id, project: site.project, date: toDayDate("2026-09-11"),
      status: "present", dailyRateSnapshot: 600, hourlyRateSnapshot: 100, cost: 600,
    });
    await saveOvertime({ labour: lid, site: String(site._id), date: "2026-09-11", hours: 2.5 });
    const detail = await getLabourReportDetail({ labourId: lid });
    // 4 (legacy field) + 2.5 (record) — same sources as the money path.
    expect(detail.attendance.otHours).toBe(6.5);
    expect(detail.cost.overtime).toBe(250);
    const analysis = await getAttendanceAnalysis({});
    expect(analysis[0].otHours).toBe(6.5);
    // Row-sum-equals-total invariant: every history row carries its day's OT.
    const { getAttendanceRecords } = await import("@/lib/reports");
    const history = await getAttendanceRecords({ labourId: lid });
    const rowSum = history.rows.reduce((s, r) => s + r.otHours, 0);
    expect(rowSum).toBe(detail.attendance.otHours);
    expect(history.rows.find((r) => new Date(r.date).toISOString().slice(0, 10) === "2026-09-10")?.otHours).toBe(4);
    expect(history.rows.find((r) => new Date(r.date).toISOString().slice(0, 10) === "2026-09-11")?.otHours).toBe(2.5);
  });

  it("salary settlement overtimeHours come from Overtime records", async () => {
    const { site, labour } = await setup();
    await Attendance.create({
      labour: labour._id, site: site._id, project: site.project, date: toDayDate("2026-09-10"),
      status: "present", dailyRateSnapshot: 600, hourlyRateSnapshot: 100, cost: 600,
    });
    await saveOvertime({ labour: String(labour._id), site: String(site._id), date: "2026-09-10", hours: 3 });
    const sal = await computeAndSaveSalary({
      labourId: String(labour._id), periodStart: "2026-09-01", periodEnd: "2026-09-30",
    });
    expect(sal!.overtimeHours).toBe(3);
    expect(sal!.overtimeAmount).toBe(300);
    expect(sal!.net).toBe(900);
  });
});
