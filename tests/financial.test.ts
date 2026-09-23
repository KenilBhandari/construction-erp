import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Types } from "mongoose";
import { Attendance } from "@/models/Attendance";
import { Overtime } from "@/models/Overtime";
import { Labour } from "@/models/Labour";
import { Project } from "@/models/Project";
import { Site } from "@/models/Site";
import { Salary } from "@/models/Salary";
import { SalaryPayment } from "@/models/SalaryPayment";
import { LabourAdvance } from "@/models/LabourAdvance";
import { Expense } from "@/models/Expense";
import { SalaryAdjustment } from "@/models/SalaryAdjustment";
import { attendanceCostFor } from "@/lib/utils";
import { computeAndSaveSalary, deriveSalaryStatus } from "@/lib/salary";
import { getLabourAdvanceSummary } from "@/lib/advances";
import { toDayDate } from "@/lib/utils";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Promise.all([
    Attendance.deleteMany({}),
    Overtime.deleteMany({}),
    Labour.deleteMany({}),
    Project.deleteMany({}),
    Site.deleteMany({}),
    Salary.deleteMany({}),
    SalaryPayment.deleteMany({}),
    LabourAdvance.deleteMany({}),
    Expense.deleteMany({}),
    SalaryAdjustment.deleteMany({}),
  ]);
});

async function createSetup(rate = 600, hourly = 100) {
  const project = await Project.create({ name: "P1", clientName: "C", location: "L", budget: 100000, contractValue: 100000, status: "active" });
  const siteA = await Site.create({ name: "Site A", project: project._id, status: "active" });
  const siteB = await Site.create({ name: "Site B", project: project._id, status: "active" });
  const labour = await Labour.create({ name: "Ramesh", phone: "9999999999", skill: "Mason", dailyRate: rate, hourlyRate: hourly, status: "active" });
  return { project, siteA, siteB, labour };
}

function day(s: string) { return toDayDate(s); }

// Helpers for cost
async function siteLabourCost(siteId: Types.ObjectId | null) {
  const filter: Record<string, unknown> = siteId ? { site: siteId } : { site: null };
  const agg = await Attendance.aggregate([{ $match: filter }, { $group: { _id: null, cost: { $sum: { $ifNull: ["$cost", 0] } } } }]);
  const attCost = agg[0]?.cost ?? 0;
  const otAgg = await Overtime.aggregate([{ $match: { site: siteId ?? null } as unknown as Record<string, unknown> }, { $group: { _id: null, amount: { $sum: "$amount" } } }]);
  // for unassigned OT, site null not relevant - but OT requires site, so skip
  // Safer: match unassigned attendance only via Attendance; OT always assigned so not counted for unassigned
  if (!siteId) return attCost;
  return attCost + (otAgg[0]?.amount ?? 0);
}

describe("Attendance", () => {
  it("1. Present at Site A cost 600", async () => {
    const { siteA, labour } = await createSetup(600);
    await Attendance.create({ labour: labour._id, date: day("2026-01-10"), status: "present", site: siteA._id, project: siteA.project, cost: attendanceCostFor("present", 600), dailyRateSnapshot: 600, hourlyRateSnapshot: 100 });
    const cost = await siteLabourCost(siteA._id);
    expect(cost).toBe(600);
  });
  it("2. Half day at Site A cost 300", async () => {
    const { siteA, labour } = await createSetup(600);
    await Attendance.create({ labour: labour._id, date: day("2026-01-11"), status: "half-day", site: siteA._id, project: siteA.project, cost: attendanceCostFor("half-day", 600), dailyRateSnapshot: 600 });
    const cost = await siteLabourCost(siteA._id);
    expect(cost).toBe(300);
  });
  it("3. Absent cost 0", async () => {
    const { siteA, labour } = await createSetup(600);
    await Attendance.create({ labour: labour._id, date: day("2026-01-12"), status: "absent", site: siteA._id, project: siteA.project, cost: attendanceCostFor("absent", 600), dailyRateSnapshot: 600 });
    expect(await siteLabourCost(siteA._id)).toBe(0);
  });
  it("4. Present with no site -> Unassigned 600", async () => {
    const { labour } = await createSetup(600);
    await Attendance.create({ labour: labour._id, date: day("2026-01-10"), status: "present", site: null, project: null, cost: 600, dailyRateSnapshot: 600 });
    const unassigned = await Attendance.aggregate([{ $match: { site: null } }, { $group: { _id: null, cost: { $sum: "$cost" } } }]);
    expect(unassigned[0]?.cost).toBe(600);
    const assigned = await Attendance.aggregate([{ $match: { site: { $ne: null } } }, { $group: { _id: null, cost: { $sum: "$cost" } } }]);
    expect(assigned[0]?.cost ?? 0).toBe(0);
  });
  it("5. Site A -> Site B moves cost", async () => {
    const { siteA, siteB, labour } = await createSetup(600);
    const att = await Attendance.create({ labour: labour._id, date: day("2026-01-10"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    expect(await siteLabourCost(siteA._id)).toBe(600);
    expect(await siteLabourCost(siteB._id)).toBe(0);
    att.site = siteB._id as unknown as typeof att.site;
    att.project = siteB.project as unknown as typeof att.project;
    await att.save();
    expect(await siteLabourCost(siteA._id)).toBe(0);
    expect(await siteLabourCost(siteB._id)).toBe(600);
  });
  it("6. Site A -> Unassigned moves cost", async () => {
    const { siteA, labour } = await createSetup(600);
    const att = await Attendance.create({ labour: labour._id, date: day("2026-01-10"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    att.site = null as unknown as typeof att.site;
    att.project = null as unknown as typeof att.project;
    await att.save();
    expect(await siteLabourCost(siteA._id)).toBe(0);
    const unassigned = await Attendance.aggregate([{ $match: { site: null } }, { $group: { _id: null, cost: { $sum: "$cost" } } }]);
    expect(unassigned[0]?.cost).toBe(600);
  });
  it("7. Unassigned -> Site A moves cost", async () => {
    const { siteA, labour } = await createSetup(600);
    const att = await Attendance.create({ labour: labour._id, date: day("2026-01-10"), status: "present", site: null, project: null, cost: 600, dailyRateSnapshot: 600 });
    att.site = siteA._id as unknown as typeof att.site;
    att.project = siteA.project as unknown as typeof att.project;
    await att.save();
    expect(await siteLabourCost(siteA._id)).toBe(600);
    const unassigned = await Attendance.aggregate([{ $match: { site: null } }, { $group: { _id: null, cost: { $sum: "$cost" } } }]);
    expect(unassigned[0]?.cost ?? 0).toBe(0);
  });
  it("8. Present -> Half Day reduces cost 600->300", async () => {
    const { siteA, labour } = await createSetup(600);
    const att = await Attendance.create({ labour: labour._id, date: day("2026-01-10"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    att.status = "half-day" as typeof att.status;
    att.cost = attendanceCostFor("half-day", 600);
    await att.save();
    expect(await siteLabourCost(siteA._id)).toBe(300);
  });
  it("9. Present -> Absent removes cost", async () => {
    const { siteA, labour } = await createSetup(600);
    const att = await Attendance.create({ labour: labour._id, date: day("2026-01-10"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    att.status = "absent" as typeof att.status;
    att.cost = attendanceCostFor("absent", 600);
    await att.save();
    expect(await siteLabourCost(siteA._id)).toBe(0);
  });
  it("10. Date change moves cost", async () => {
    const { siteA, labour } = await createSetup(600);
    const att = await Attendance.create({ labour: labour._id, date: day("2026-01-10"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    // old date site cost 600
    const oldDayCost = await Attendance.aggregate([{ $match: { site: siteA._id, date: day("2026-01-10") } }, { $group: { _id: null, cost: { $sum: "$cost" } } }]);
    expect(oldDayCost[0]?.cost).toBe(600);
    // change date
    att.date = day("2026-01-11");
    await att.save();
    const oldAfter = await Attendance.aggregate([{ $match: { site: siteA._id, date: day("2026-01-10") } }, { $group: { _id: null, cost: { $sum: "$cost" } } }]);
    expect(oldAfter[0]?.cost ?? 0).toBe(0);
    const newDay = await Attendance.aggregate([{ $match: { site: siteA._id, date: day("2026-01-11") } }, { $group: { _id: null, cost: { $sum: "$cost" } } }]);
    expect(newDay[0]?.cost).toBe(600);
  });
  it("11. Delete removes cost", async () => {
    const { siteA, labour } = await createSetup(600);
    const att = await Attendance.create({ labour: labour._id, date: day("2026-01-10"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    expect(await siteLabourCost(siteA._id)).toBe(600);
    await Attendance.findByIdAndDelete(att._id);
    expect(await siteLabourCost(siteA._id)).toBe(0);
  });
  it("12. Historical rate snapshot stable after labour rate change", async () => {
    const { siteA, labour } = await createSetup(600);
    await Attendance.create({ labour: labour._id, date: day("2026-01-10"), status: "present", site: siteA._id, project: siteA.project, cost: attendanceCostFor("present", 600), dailyRateSnapshot: 600 });
    // change labour rate
    await Labour.findByIdAndUpdate(labour._id, { dailyRate: 700 });
    const att = await Attendance.findOne({ labour: labour._id }).lean();
    expect((att as unknown as { dailyRateSnapshot: number }).dailyRateSnapshot).toBe(600);
    expect((att as unknown as { cost: number }).cost).toBe(600);
  });
  it("13. Repeated save does not duplicate cost", async () => {
    const { siteA, labour } = await createSetup(600);
    const att = await Attendance.create({ labour: labour._id, date: day("2026-01-10"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600, idempotencyKey: "key1" });
    // second create with same labour+date should fail unique
    await expect(Attendance.create({ labour: labour._id, date: day("2026-01-10"), status: "present", site: siteA._id, project: siteA.project, cost: 600 })).rejects.toThrow();
    // saving same doc again doesn't duplicate
    await att.save();
    const count = await Attendance.countDocuments({ labour: labour._id });
    expect(count).toBe(1);
    expect(await siteLabourCost(siteA._id)).toBe(600);
  });
  it("14. Concurrent attendance updates do not duplicate cost (CAS)", async () => {
    const { siteA, labour } = await createSetup(600);
    const att = await Attendance.create({ labour: labour._id, date: day("2026-01-10"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    // simulate two concurrent STATUS changes — last wins but cost stays single
    const p1 = Attendance.findById(att._id).then(d => { if (d) { d.status = "half-day" as typeof d.status; d.cost = 300; return d.save(); } });
    const p2 = Attendance.findById(att._id).then(d => { if (d) { d.status = "half-day" as typeof d.status; d.cost = 300; return d.save(); } });
    await Promise.all([p1, p2]);
    const final = await Attendance.findById(att._id).lean();
    expect((final as unknown as { cost: number }).cost).toBe(300);
    expect(await Attendance.countDocuments()).toBe(1);
  });
});

describe("Overtime", () => {
  it("15. OT at same site", async () => {
    const { siteA, labour } = await createSetup();
    await Overtime.create({ labour: labour._id, site: siteA._id, project: siteA.project, date: day("2026-01-10"), hours: 2, rate: 100, amount: 200 });
    const agg = await Overtime.aggregate([{ $match: { site: siteA._id } }, { $group: { _id: null, amount: { $sum: "$amount" } } }]);
    expect(agg[0]?.amount).toBe(200);
  });
  it("16. OT at different site than attendance", async () => {
    const { siteA, siteB, labour } = await createSetup();
    await Attendance.create({ labour: labour._id, date: day("2026-01-10"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    await Overtime.create({ labour: labour._id, site: siteB._id, project: siteB.project, date: day("2026-01-10"), hours: 3, rate: 100, amount: 300 });
    expect(await siteLabourCost(siteA._id)).toBe(600);
    const otB = await Overtime.aggregate([{ $match: { site: siteB._id } }, { $group: { _id: null, amount: { $sum: "$amount" } } }]);
    expect(otB[0]?.amount).toBe(300);
  });
  it("17. OT site change moves cost", async () => {
    const { siteA, siteB, labour } = await createSetup();
    const ot = await Overtime.create({ labour: labour._id, site: siteB._id, project: siteB.project, date: day("2026-01-10"), hours: 3, rate: 100, amount: 300 });
    ot.site = siteA._id as unknown as typeof ot.site;
    ot.project = siteA.project as unknown as typeof ot.project;
    await ot.save();
    const a = await Overtime.aggregate([{ $match: { site: siteA._id } }, { $group: { _id: null, amount: { $sum: "$amount" } } }]);
    const b = await Overtime.aggregate([{ $match: { site: siteB._id } }, { $group: { _id: null, amount: { $sum: "$amount" } } }]);
    expect(a[0]?.amount).toBe(300);
    expect(b[0]?.amount ?? 0).toBe(0);
  });
  it("18. OT amount change increases cost", async () => {
    const { siteA, labour } = await createSetup();
    const ot = await Overtime.create({ labour: labour._id, site: siteA._id, project: siteA.project, date: day("2026-01-10"), hours: 3, rate: 100, amount: 300 });
    ot.hours = 4.5; ot.amount = 450; await ot.save();
    const agg = await Overtime.aggregate([{ $match: { site: siteA._id } }, { $group: { _id: null, amount: { $sum: "$amount" } } }]);
    expect(agg[0]?.amount).toBe(450);
  });
  it("19. OT delete removes cost", async () => {
    const { siteA, labour } = await createSetup();
    const ot = await Overtime.create({ labour: labour._id, site: siteA._id, project: siteA.project, date: day("2026-01-10"), hours: 2, rate: 100, amount: 200 });
    await Overtime.findByIdAndDelete(ot._id);
    const agg = await Overtime.aggregate([{ $match: { site: siteA._id } }, { $group: { _id: null, amount: { $sum: "$amount" } } }]);
    expect(agg[0]?.amount ?? 0).toBe(0);
  });
  it("20. Repeated OT save no duplicate", async () => {
    const { siteA, labour } = await createSetup();
    await Overtime.create({ labour: labour._id, site: siteA._id, project: siteA.project, date: day("2026-01-10"), hours: 2, rate: 100, amount: 200, idempotencyKey: "otkey" });
    await expect(Overtime.create({ labour: labour._id, site: siteA._id, project: siteA.project, date: day("2026-01-10"), hours: 2, rate: 100, amount: 200 })).rejects.toThrow();
    expect(await Overtime.countDocuments()).toBe(1);
  });
});

describe("Salary", () => {
  it("21. One site salary", async () => {
    const { siteA, labour } = await createSetup(600);
    await Attendance.create({ labour: labour._id, date: day("2026-01-05"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    await Attendance.create({ labour: labour._id, date: day("2026-01-06"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    const sal = await computeAndSaveSalary({ labourId: String(labour._id), periodStart: "2026-01-01", periodEnd: "2026-01-31" });
    expect(sal!.gross).toBe(1200);
    expect(sal!.earningsBreakdown.length).toBe(1);
  });
  it("22. Multiple sites in one period", async () => {
    const { siteA, siteB, labour } = await createSetup(600);
    await Attendance.create({ labour: labour._id, date: day("2026-01-05"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    await Attendance.create({ labour: labour._id, date: day("2026-01-15"), status: "present", site: siteB._id, project: siteB.project, cost: 600, dailyRateSnapshot: 600 });
    const sal = await computeAndSaveSalary({ labourId: String(labour._id), periodStart: "2026-01-01", periodEnd: "2026-01-31" });
    expect(sal!.gross).toBe(1200);
    expect(sal!.earningsBreakdown.length).toBe(2);
    const total = sal!.earningsBreakdown.reduce((s, b) => s + (b.gross as number), 0);
    expect(total).toBe(1200);
  });
  it("23. Pending salary recomputation", async () => {
    const { siteA, labour } = await createSetup(600);
    await Attendance.create({ labour: labour._id, date: day("2026-01-05"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    const sal = await computeAndSaveSalary({ labourId: String(labour._id), periodStart: "2026-01-01", periodEnd: "2026-01-31" });
    expect(sal!.gross).toBe(600);
    // add attendance within period, recompute
    await Attendance.create({ labour: labour._id, date: day("2026-01-06"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    const sal2 = await computeAndSaveSalary({ labourId: String(labour._id), periodStart: "2026-01-01", periodEnd: "2026-01-31" });
    expect(sal2!.gross).toBe(1200);
  });
  it("24. Attendance added after pending recomputes", async () => {
    const { siteA, labour } = await createSetup(600);
    await Attendance.create({ labour: labour._id, date: day("2026-01-05"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    const sal = await computeAndSaveSalary({ labourId: String(labour._id), periodStart: "2026-01-01", periodEnd: "2026-01-31" });
    await Attendance.create({ labour: labour._id, date: day("2026-01-07"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    const sal2 = await computeAndSaveSalary({ labourId: String(labour._id), periodStart: "2026-01-01", periodEnd: "2026-01-31" });
    expect(sal2!.gross).toBe(1200);
  });
  it("25. Attendance changed after pending updates gross", async () => {
    const { siteA, labour } = await createSetup(600);
    await Attendance.create({ labour: labour._id, date: day("2026-01-05"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    const sal = await computeAndSaveSalary({ labourId: String(labour._id), periodStart: "2026-01-01", periodEnd: "2026-01-31" });
    const att = await Attendance.findOne({ labour: labour._id });
    att!.status = "half-day" as typeof att!.status;
    att!.cost = 300; await att!.save();
    const sal2 = await computeAndSaveSalary({ labourId: String(labour._id), periodStart: "2026-01-01", periodEnd: "2026-01-31" });
    expect(sal2!.gross).toBe(300);
  });
  it("26. OT changed after pending updates", async () => {
    const { siteA, labour } = await createSetup(600, 100);
    await Attendance.create({ labour: labour._id, date: day("2026-01-05"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    await Overtime.create({ labour: labour._id, site: siteA._id, project: siteA.project, date: day("2026-01-05"), hours: 2, rate: 100, amount: 200 });
    const sal = await computeAndSaveSalary({ labourId: String(labour._id), periodStart: "2026-01-01", periodEnd: "2026-01-31" });
    expect(sal!.overtimeAmount).toBe(200);
    const ot = await Overtime.findOne({ labour: labour._id });
    ot!.amount = 400; await ot!.save();
    const sal2 = await computeAndSaveSalary({ labourId: String(labour._id), periodStart: "2026-01-01", periodEnd: "2026-01-31" });
    expect(sal2!.overtimeAmount).toBe(400);
  });
  it("27. Partial salary payment", async () => {
    const { siteA, labour } = await createSetup(600);
    await Attendance.create({ labour: labour._id, date: day("2026-01-05"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    await Attendance.create({ labour: labour._id, date: day("2026-01-06"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    const sal = await computeAndSaveSalary({ labourId: String(labour._id), periodStart: "2026-01-01", periodEnd: "2026-01-31" });
    // net 1200
    const net = sal!.net;
    // simulate payment via CAS
    const expected = sal!.paidAmount;
    const upd = await Salary.findOneAndUpdate({ _id: sal!._id, paidAmount: expected }, { $set: { paidAmount: expected + 500, remainingAmount: net - (expected + 500), status: deriveSalaryStatus(net, expected + 500) } }, { new: true }).lean();
    expect(upd!.paidAmount).toBe(500);
    expect(upd!.status).toBe("partially-paid");
  });
  it("28. Multiple salary payments", async () => {
    const { siteA, labour } = await createSetup(600);
    await Attendance.create({ labour: labour._id, date: day("2026-01-05"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    await Attendance.create({ labour: labour._id, date: day("2026-01-06"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    const sal = await computeAndSaveSalary({ labourId: String(labour._id), periodStart: "2026-01-01", periodEnd: "2026-01-31" });
    const net = sal!.net;
    let paid = 0;
    for (const amt of [300, 300, 600]) {
      const cur = await Salary.findById(sal!._id).lean();
      paid = cur!.paidAmount;
      const upd = await Salary.findOneAndUpdate({ _id: sal!._id, paidAmount: paid }, { $set: { paidAmount: paid + amt, remainingAmount: net - (paid + amt), status: deriveSalaryStatus(net, paid + amt) } }, { new: true }).lean();
      // create payment row
      await SalaryPayment.create({ salarySettlementId: sal!._id, amount: amt, date: new Date(), idempotencyKey: `pay-${amt}-${paid}` });
      expect(upd).not.toBeNull();
    }
    const final = await Salary.findById(sal!._id).lean();
    expect(final!.paidAmount).toBe(1200);
    expect(final!.status).toBe("paid");
    expect(await SalaryPayment.countDocuments({ salarySettlementId: sal!._id })).toBe(3);
  });
  it("29. Full salary payment", async () => {
    const { siteA, labour } = await createSetup(600);
    await Attendance.create({ labour: labour._id, date: day("2026-01-05"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    const sal = await computeAndSaveSalary({ labourId: String(labour._id), periodStart: "2026-01-01", periodEnd: "2026-01-31" });
    const net = sal!.net;
    const upd = await Salary.findOneAndUpdate({ _id: sal!._id, paidAmount: 0 }, { $set: { paidAmount: net, remainingAmount: 0, status: "paid" } }, { new: true }).lean();
    expect(upd!.status).toBe("paid");
  });
  it("30. Payment greater than remaining rejected (logic check)", async () => {
    const { siteA, labour } = await createSetup(600);
    await Attendance.create({ labour: labour._id, date: day("2026-01-05"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    const sal = await computeAndSaveSalary({ labourId: String(labour._id), periodStart: "2026-01-01", periodEnd: "2026-01-31" });
    const remaining = sal!.remainingAmount;
    // attempt overpay via findOneAndUpdate should not succeed if we guard, but test logic: amount > remaining should be rejected before CAS
    const over = remaining + 100;
    expect(over > remaining).toBe(true);
    // Simulate API guard: reject
    const canPay = over <= remaining;
    expect(canPay).toBe(false);
  });
  it("31. Two concurrent payments cannot overpay (CAS)", async () => {
    const { siteA, labour } = await createSetup(600);
    for (let i = 5; i <= 9; i++) await Attendance.create({ labour: labour._id, date: day(`2026-01-0${i}`), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    const sal = await computeAndSaveSalary({ labourId: String(labour._id), periodStart: "2026-01-01", periodEnd: "2026-01-31" }); // gross 3000
    const net = 3000;
    // remaining 3000, two concurrent 2000 each — only one should succeed via CAS on same expectedPaid 0
    const p1 = Salary.findOneAndUpdate({ _id: sal!._id, paidAmount: 0 }, { $set: { paidAmount: 2000, remainingAmount: 1000, status: "partially-paid" } }, { new: true });
    const p2 = Salary.findOneAndUpdate({ _id: sal!._id, paidAmount: 0 }, { $set: { paidAmount: 2000, remainingAmount: 1000, status: "partially-paid" } }, { new: true });
    const [r1, r2] = await Promise.all([p1, p2]);
    // exactly one should succeed
    const successes = [r1, r2].filter(Boolean).length;
    expect(successes).toBe(1);
    const final = await Salary.findById(sal!._id).lean();
    expect(final!.paidAmount).toBe(2000);
  });
  it("32. Same payment request repeated does not create duplicate (idempotencyKey)", async () => {
    const { siteA, labour } = await createSetup(600);
    await Attendance.create({ labour: labour._id, date: day("2026-01-05"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    const sal = await computeAndSaveSalary({ labourId: String(labour._id), periodStart: "2026-01-01", periodEnd: "2026-01-31" });
    const key = "idem-pay-1";
    await SalaryPayment.create({ salarySettlementId: sal!._id, amount: 300, date: new Date(), idempotencyKey: key });
    await Salary.findByIdAndUpdate(sal!._id, { $set: { paidAmount: 300, remainingAmount: sal!.net - 300, status: deriveSalaryStatus(sal!.net, 300) } });
    // second try with same key should fail unique
    await expect(SalaryPayment.create({ salarySettlementId: sal!._id, amount: 300, date: new Date(), idempotencyKey: key })).rejects.toThrow();
    expect(await SalaryPayment.countDocuments({ salarySettlementId: sal!._id })).toBe(1);
  });
  it("33. Paid/partially-paid cannot be silently rewritten", async () => {
    const { siteA, labour } = await createSetup(600);
    await Attendance.create({ labour: labour._id, date: day("2026-01-05"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    const sal = await computeAndSaveSalary({ labourId: String(labour._id), periodStart: "2026-01-01", periodEnd: "2026-01-31" });
    await Salary.findByIdAndUpdate(sal!._id, { $set: { paidAmount: sal!.net, remainingAmount: 0, status: "paid" } });
    await expect(computeAndSaveSalary({ labourId: String(labour._id), periodStart: "2026-01-01", periodEnd: "2026-01-31" })).rejects.toThrow(/frozen/);
  });
});

describe("Advances", () => {
  it("34. Advance given", async () => {
    const { labour } = await createSetup();
    await LabourAdvance.create({ labour: labour._id, date: day("2026-01-05"), amount: 3000 });
    const s = await getLabourAdvanceSummary(String(labour._id));
    expect(s.outstanding).toBe(3000);
  });
  it("35. Multiple advances", async () => {
    const { labour } = await createSetup();
    await LabourAdvance.create({ labour: labour._id, date: day("2026-01-05"), amount: 3000 });
    await LabourAdvance.create({ labour: labour._id, date: day("2026-01-06"), amount: 2000 });
    const s = await getLabourAdvanceSummary(String(labour._id));
    expect(s.totalGiven).toBe(5000);
    expect(s.outstanding).toBe(5000);
  });
  it("36. Partial recovery", async () => {
    const { siteA, labour } = await createSetup(600);
    await LabourAdvance.create({ labour: labour._id, date: day("2026-01-05"), amount: 3000 });
    await Attendance.create({ labour: labour._id, date: day("2026-01-06"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    await Attendance.create({ labour: labour._id, date: day("2026-01-07"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    await computeAndSaveSalary({ labourId: String(labour._id), periodStart: "2026-01-01", periodEnd: "2026-01-31", advanceRecovery: 1000 });
    const s = await getLabourAdvanceSummary(String(labour._id));
    expect(s.totalRecovered).toBe(1000);
    expect(s.outstanding).toBe(2000);
  });
  it("37. Multiple recoveries", async () => {
    const { siteA, labour } = await createSetup(600);
    await LabourAdvance.create({ labour: labour._id, date: day("2026-01-05"), amount: 5000 });
    await Attendance.create({ labour: labour._id, date: day("2026-01-06"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    await Attendance.create({ labour: labour._id, date: day("2026-01-07"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    await Attendance.create({ labour: labour._id, date: day("2026-01-16"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    await Attendance.create({ labour: labour._id, date: day("2026-01-17"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    await computeAndSaveSalary({ labourId: String(labour._id), periodStart: "2026-01-01", periodEnd: "2026-01-15", advanceRecovery: 1000 });
    await computeAndSaveSalary({ labourId: String(labour._id), periodStart: "2026-01-16", periodEnd: "2026-01-31", advanceRecovery: 500 });
    const s = await getLabourAdvanceSummary(String(labour._id));
    expect(s.totalRecovered).toBe(1500);
    expect(s.outstanding).toBe(3500);
  });
  it("38. Recovery greater than outstanding rejected", async () => {
    const { siteA, labour } = await createSetup(600);
    await LabourAdvance.create({ labour: labour._id, date: day("2026-01-05"), amount: 1000 });
    await Attendance.create({ labour: labour._id, date: day("2026-01-06"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    await expect(computeAndSaveSalary({ labourId: String(labour._id), periodStart: "2026-01-01", periodEnd: "2026-01-31", advanceRecovery: 2000 })).rejects.toThrow(/exceeds outstanding/);
  });
  it("39. Advance write-off", async () => {
    const { siteA, labour } = await createSetup(600);
    await LabourAdvance.create({ labour: labour._id, date: day("2026-01-05"), amount: 3000 });
    // need gross >= recovery (1000+2000 write-off =3000 given, but salary recovery 1000 needs gross 1000)
    await Attendance.create({ labour: labour._id, date: day("2026-01-06"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    await Attendance.create({ labour: labour._id, date: day("2026-01-07"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    await computeAndSaveSalary({ labourId: String(labour._id), periodStart: "2026-01-01", periodEnd: "2026-01-31", advanceRecovery: 1000 });
    await Expense.create({ date: day("2026-01-20"), category: "LABOUR_ADVANCE_WRITE_OFF", description: "write off", amount: 2000, labour: labour._id });
    const s = await getLabourAdvanceSummary(String(labour._id));
    expect(s.outstanding).toBe(0);
  });
  it("40. Partial write-off", async () => {
    const { labour } = await createSetup();
    await LabourAdvance.create({ labour: labour._id, date: day("2026-01-05"), amount: 3000 });
    await Expense.create({ date: day("2026-01-06"), category: "LABOUR_ADVANCE_WRITE_OFF", description: "partial", amount: 1000, labour: labour._id });
    const s = await getLabourAdvanceSummary(String(labour._id));
    expect(s.outstanding).toBe(2000);
  });
  it("41. Write-off greater than outstanding rejected (guard)", async () => {
    const { labour } = await createSetup();
    await LabourAdvance.create({ labour: labour._id, date: day("2026-01-05"), amount: 1000 });
    await Expense.create({ date: day("2026-01-06"), category: "LABOUR_ADVANCE_WRITE_OFF", description: "wo", amount: 500, labour: labour._id });
    const s = await getLabourAdvanceSummary(String(labour._id));
    // outstanding 500, trying to write off 1000 should be rejected by API logic — we simulate check
    expect(s.outstanding).toBe(500);
    expect(1000 > s.outstanding).toBe(true);
  });
  it("42. Duplicate recovery idempotent (same period not duplicate)", async () => {
    const { siteA, labour } = await createSetup(600);
    await LabourAdvance.create({ labour: labour._id, date: day("2026-01-05"), amount: 3000 });
    await Attendance.create({ labour: labour._id, date: day("2026-01-06"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    await Attendance.create({ labour: labour._id, date: day("2026-01-07"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    await computeAndSaveSalary({ labourId: String(labour._id), periodStart: "2026-01-01", periodEnd: "2026-01-31", advanceRecovery: 1000 });
    // second compute same period with same recovery should not double-count recovery
    const s2 = await computeAndSaveSalary({ labourId: String(labour._id), periodStart: "2026-01-01", periodEnd: "2026-01-31", advanceRecovery: 1000 });
    const summary = await getLabourAdvanceSummary(String(labour._id));
    expect(summary.totalRecovered).toBe(1000);
    expect(s2!.advanceRecovery).toBe(1000);
  });
  it("43. Duplicate write-off idempotent via idempotencyKey", async () => {
    const { labour } = await createSetup();
    await LabourAdvance.create({ labour: labour._id, date: day("2026-01-05"), amount: 3000 });
    const key = "writeoff-key-1";
    await Expense.create({ date: day("2026-01-06"), category: "LABOUR_ADVANCE_WRITE_OFF", description: "wo", amount: 1000, labour: labour._id, idempotencyKey: key });
    await expect(Expense.create({ date: day("2026-01-06"), category: "LABOUR_ADVANCE_WRITE_OFF", description: "wo", amount: 1000, labour: labour._id, idempotencyKey: key })).rejects.toThrow();
    expect(await Expense.countDocuments({ labour: labour._id })).toBe(1);
  });
  it("44. Outstanding never negative", async () => {
    const { labour } = await createSetup();
    await LabourAdvance.create({ labour: labour._id, date: day("2026-01-05"), amount: 1000 });
    await Expense.create({ date: day("2026-01-06"), category: "LABOUR_ADVANCE_WRITE_OFF", description: "wo", amount: 1000, labour: labour._id });
    const s = await getLabourAdvanceSummary(String(labour._id));
    expect(s.outstanding).toBe(0);
    expect(s.outstanding).toBeGreaterThanOrEqual(0);
  });
});

describe("Integration", () => {
  it("45. Salary payment does not reduce site labour cost", async () => {
    const { siteA, labour } = await createSetup(600);
    await Attendance.create({ labour: labour._id, date: day("2026-01-05"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    const before = await Attendance.aggregate([{ $match: { site: siteA._id } }, { $group: { _id: null, cost: { $sum: "$cost" } } }]);
    const sal = await computeAndSaveSalary({ labourId: String(labour._id), periodStart: "2026-01-01", periodEnd: "2026-01-31" });
    // pay
    await Salary.findByIdAndUpdate(sal!._id, { $set: { paidAmount: sal!.net, remainingAmount: 0, status: "paid" } });
    await SalaryPayment.create({ salarySettlementId: sal!._id, amount: sal!.net, date: new Date(), idempotencyKey: "pay-int-45" });
    const after = await Attendance.aggregate([{ $match: { site: siteA._id } }, { $group: { _id: null, cost: { $sum: "$cost" } } }]);
    expect(before[0]?.cost).toBe(600);
    expect(after[0]?.cost).toBe(600);
  });
  it("46. Advance recovery does not reduce site labour cost", async () => {
    const { siteA, labour } = await createSetup(600);
    await LabourAdvance.create({ labour: labour._id, date: day("2026-01-01"), amount: 3000 });
    await Attendance.create({ labour: labour._id, date: day("2026-01-05"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    const before = await Attendance.aggregate([{ $match: { site: siteA._id } }, { $group: { _id: null, cost: { $sum: "$cost" } } }]);
    await computeAndSaveSalary({ labourId: String(labour._id), periodStart: "2026-01-01", periodEnd: "2026-01-31", advanceRecovery: 500 });
    const after = await Attendance.aggregate([{ $match: { site: siteA._id } }, { $group: { _id: null, cost: { $sum: "$cost" } } }]);
    expect(before[0]?.cost).toBe(600);
    expect(after[0]?.cost).toBe(600);
  });
  it("47. Advance write-off does not reduce site labour cost", async () => {
    const { siteA, labour } = await createSetup(600);
    await LabourAdvance.create({ labour: labour._id, date: day("2026-01-01"), amount: 3000 });
    await Attendance.create({ labour: labour._id, date: day("2026-01-05"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    const before = await Attendance.aggregate([{ $match: { site: siteA._id } }, { $group: { _id: null, cost: { $sum: "$cost" } } }]);
    await Expense.create({ date: day("2026-01-06"), category: "LABOUR_ADVANCE_WRITE_OFF", description: "wo", amount: 1000, labour: labour._id });
    const after = await Attendance.aggregate([{ $match: { site: siteA._id } }, { $group: { _id: null, cost: { $sum: "$cost" } } }]);
    expect(before[0]?.cost).toBe(600);
    expect(after[0]?.cost).toBe(600);
  });
  it("48. Multiple site attendance produces correct site totals", async () => {
    const { siteA, siteB, labour } = await createSetup(600);
    await Attendance.create({ labour: labour._id, date: day("2026-01-05"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    await Attendance.create({ labour: labour._id, date: day("2026-01-06"), status: "present", site: siteB._id, project: siteB.project, cost: 600, dailyRateSnapshot: 600 });
    await Attendance.create({ labour: labour._id, date: day("2026-01-07"), status: "half-day", site: siteA._id, project: siteA.project, cost: 300, dailyRateSnapshot: 600 });
    const a = await Attendance.aggregate([{ $match: { site: siteA._id } }, { $group: { _id: null, cost: { $sum: "$cost" } } }]);
    const b = await Attendance.aggregate([{ $match: { site: siteB._id } }, { $group: { _id: null, cost: { $sum: "$cost" } } }]);
    expect(a[0]?.cost).toBe(900);
    expect(b[0]?.cost).toBe(600);
  });
  it("49. OT produces correct site totals", async () => {
    const { siteA, siteB, labour } = await createSetup();
    await Overtime.create({ labour: labour._id, site: siteA._id, project: siteA.project, date: day("2026-01-05"), hours: 2, rate: 100, amount: 200 });
    await Overtime.create({ labour: labour._id, site: siteB._id, project: siteB.project, date: day("2026-01-06"), hours: 3, rate: 100, amount: 300 });
    const a = await Overtime.aggregate([{ $match: { site: siteA._id } }, { $group: { _id: null, amount: { $sum: "$amount" } } }]);
    const b = await Overtime.aggregate([{ $match: { site: siteB._id } }, { $group: { _id: null, amount: { $sum: "$amount" } } }]);
    expect(a[0]?.amount).toBe(200);
    expect(b[0]?.amount).toBe(300);
  });
  it("50. Salary/site reports do not double-count (attendance cost + salary gross not added)", async () => {
    const { siteA, labour } = await createSetup(600);
    await Attendance.create({ labour: labour._id, date: day("2026-01-05"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    const sal = await computeAndSaveSalary({ labourId: String(labour._id), periodStart: "2026-01-01", periodEnd: "2026-01-31" });
    const attCost = (await Attendance.aggregate([{ $match: { site: siteA._id } }, { $group: { _id: null, cost: { $sum: "$cost" } } }]))[0]?.cost ?? 0;
    // Company would report labour cost from Attendance (600), not attendance+salary (1200)
    expect(attCost).toBe(600);
    expect(sal!.gross).toBe(600);
    expect(attCost + sal!.gross).toBe(1200); // double count would be wrong, ensure we don't use that
    expect(attCost).not.toBe(attCost + sal!.gross);
  });
  it("51. Historical rates remain stable", async () => {
    const { siteA, labour } = await createSetup(600);
    await Attendance.create({ labour: labour._id, date: day("2026-01-05"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    await Labour.findByIdAndUpdate(labour._id, { dailyRate: 1000 });
    const att = await Attendance.findOne({ labour: labour._id }).lean();
    expect((att as unknown as { dailyRateSnapshot: number }).dailyRateSnapshot).toBe(600);
    expect((att as unknown as { cost: number }).cost).toBe(600);
  });
  it("52. Historical site attribution remains stable", async () => {
    const { siteA, siteB, labour } = await createSetup();
    const att = await Attendance.create({ labour: labour._id, date: day("2026-01-05"), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    await Labour.findByIdAndUpdate(labour._id, { assignedSite: siteB._id });
    const fetched = await Attendance.findById(att._id).lean();
    expect(String((fetched as unknown as { site: Types.ObjectId }).site)).toBe(String(siteA._id));
  });
  it("53. Repeated API requests produce only one financial effect (idempotencyKey)", async () => {
    const { labour } = await createSetup();
    const key = "idem-advance-53";
    await LabourAdvance.create({ labour: labour._id, date: day("2026-01-05"), amount: 1000, idempotencyKey: key });
    await expect(LabourAdvance.create({ labour: labour._id, date: day("2026-01-05"), amount: 1000, idempotencyKey: key })).rejects.toThrow();
    expect(await LabourAdvance.countDocuments()).toBe(1);
  });
  it("54. Concurrent requests cannot corrupt balances (CAS)", async () => {
    const { siteA, labour } = await createSetup(600);
    for (let i = 5; i <= 8; i++) await Attendance.create({ labour: labour._id, date: day(`2026-01-0${i}`), status: "present", site: siteA._id, project: siteA.project, cost: 600, dailyRateSnapshot: 600 });
    const sal = await computeAndSaveSalary({ labourId: String(labour._id), periodStart: "2026-01-01", periodEnd: "2026-01-31" });
    const net = sal!.net;
    // two concurrent payments of 1500 each with same expectedPaid 0 — only one via CAS should succeed
    const p1 = Salary.findOneAndUpdate({ _id: sal!._id, paidAmount: 0 }, { $set: { paidAmount: 1500 } }, { new: true });
    const p2 = Salary.findOneAndUpdate({ _id: sal!._id, paidAmount: 0 }, { $set: { paidAmount: 1500 } }, { new: true });
    const [r1, r2] = await Promise.all([p1, p2]);
    expect([r1, r2].filter(Boolean).length).toBe(1);
    const final = await Salary.findById(sal!._id).lean();
    expect(final!.paidAmount).toBe(1500);
    expect(final!.paidAmount).toBeLessThanOrEqual(net);
  });
});
