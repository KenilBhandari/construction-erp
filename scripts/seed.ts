/**
 * Development seed: realistic construction data so the dashboard looks alive.
 * Run: npm run seed   (needs MONGODB_URI in .env.local or .env)
 *
 * Clears domain collections (keeps users) and creates:
 * 3 projects, 5 sites, 10 materials, 15 labourers, 7 days of attendance,
 * overtime, advances, salaries, purchases, consumption, expenses, payments.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import mongoose, { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { toDayDate } from "@/lib/utils";
import { applyStockEffect, stockEffect } from "@/lib/stock";
import { computeAndSaveSalary, deriveSalaryStatus } from "@/lib/salary";
import { Project } from "@/models/Project";
import { Site } from "@/models/Site";
import { Material } from "@/models/Material";
import { StockTransaction } from "@/models/StockTransaction";
import { Labour } from "@/models/Labour";
import { LabourAssignment } from "@/models/LabourAssignment";
import { Attendance } from "@/models/Attendance";
import { Overtime } from "@/models/Overtime";
import { LabourAdvance } from "@/models/LabourAdvance";
import { Salary } from "@/models/Salary";
import { Expense } from "@/models/Expense";
import { ClientPayment } from "@/models/ClientPayment";

/** Deterministic PRNG so reseeds look the same. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDayDate(d.toISOString().slice(0, 10));
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not set. Copy .env.example to .env.local first.");
  }
  await connectDB();
  console.log("Clearing domain collections…");
  await Promise.all([
    Project.deleteMany(),
    Site.deleteMany(),
    Material.deleteMany(),
    StockTransaction.deleteMany(),
    Labour.deleteMany(),
    LabourAssignment.deleteMany(),
    Attendance.deleteMany(),
    Overtime.deleteMany(),
    LabourAdvance.deleteMany(),
    Salary.deleteMany(),
    Expense.deleteMany(),
    ClientPayment.deleteMany(),
  ]);

  // --- Projects ---
  const [patel, shree, farmhouse] = await Project.create([
    {
      name: "Patel Residence",
      clientName: "Rajesh Patel",
      clientPhone: "98765 43210",
      location: "Ahmedabad",
      startDate: new Date("2026-08-01"),
      expectedEndDate: new Date("2026-11-30"),
      budget: 2200000,
      contractValue: 2500000,
      status: "active",
      progress: 65,
      description: "Residential bungalow — structure, finishing and compound.",
    },
    {
      name: "Shree Heights",
      clientName: "Amit Shah",
      clientPhone: "98250 11111",
      location: "Vadodara",
      startDate: new Date("2026-09-01"),
      expectedEndDate: new Date("2027-02-28"),
      budget: 4200000,
      contractValue: 4800000,
      status: "active",
      progress: 30,
      description: "Two residential towers — RCC frame in progress.",
    },
    {
      name: "Farmhouse Compound",
      clientName: "Meena Desai",
      clientPhone: "98980 22222",
      location: "Gandhinagar",
      startDate: new Date("2026-10-01"),
      expectedEndDate: new Date("2026-12-31"),
      budget: 700000,
      contractValue: 800000,
      status: "planning",
      progress: 0,
      description: "Boundary wall and gates for farmhouse plot.",
    },
  ]);
  console.log("Projects: 3");

  // --- Sites ---
  const [main, parking, boundary, towerA, towerB] = await Site.create([
    { name: "Main Building", project: patel._id, location: "Block A", supervisor: "R. Sharma", status: "active", progress: 75 },
    { name: "Parking", project: patel._id, location: "East side", supervisor: "R. Sharma", status: "active", progress: 50 },
    { name: "Boundary Wall", project: patel._id, location: "Perimeter", supervisor: "K. Patel", status: "active", progress: 90 },
    { name: "Tower A", project: shree._id, location: "Wing A", supervisor: "V. Iyer", status: "active", progress: 35 },
    { name: "Tower B", project: shree._id, location: "Wing B", supervisor: "V. Iyer", status: "active", progress: 20 },
  ]);
  const siteProject = new Map<string, Types.ObjectId>([
    [String(main._id), patel._id],
    [String(parking._id), patel._id],
    [String(boundary._id), patel._id],
    [String(towerA._id), shree._id],
    [String(towerB._id), shree._id],
  ]);
  console.log("Sites: 5");

  // --- Materials (opening stock enters the ledger as adjustments) ---
  const materialDefs: {
    name: string;
    category: string;
    unit: string;
    min: number;
    rate: number;
    opening: number;
  }[] = [
    { name: "Cement (UltraTech)", category: "Cement", unit: "Bag", min: 50, rate: 380, opening: 120 },
    { name: "River Sand", category: "Sand", unit: "Cubic Feet", min: 100, rate: 45, opening: 400 },
    { name: "Steel 12mm", category: "Steel", unit: "Kg", min: 200, rate: 62, opening: 800 },
    { name: "Red Bricks", category: "Bricks", unit: "Piece", min: 2000, rate: 9, opening: 8000 },
    { name: "Aggregate 20mm", category: "Aggregate", unit: "Cubic Feet", min: 100, rate: 55, opening: 300 },
    { name: "Vitrified Tiles 2x2", category: "Tiles", unit: "Piece", min: 100, rate: 85, opening: 0 },
    { name: "Asian Paints", category: "Paint", unit: "Liter", min: 20, rate: 320, opening: 60 },
    { name: "PVC Pipes 4 inch", category: "Pipes", unit: "Meter", min: 30, rate: 140, opening: 100 },
    { name: "Electrical Wire", category: "Electrical", unit: "Meter", min: 50, rate: 95, opening: 200 },
    { name: "Plywood 18mm", category: "Wood", unit: "Piece", min: 10, rate: 1800, opening: 25 },
  ];
  const materials = [];
  for (const def of materialDefs) {
    const created = await Material.create({
      name: def.name,
      category: def.category,
      unit: def.unit,
      currentStock: 0,
      minimumStock: def.min,
      defaultPurchaseRate: def.rate,
      notes: null,
    });
    if (def.opening > 0) {
      await StockTransaction.create({
        material: created._id,
        project: null,
        site: null,
        date: daysAgo(30),
        type: "adjustment",
        quantity: def.opening,
        unit: def.unit,
        rate: 0,
        total: 0,
        notes: "Opening stock",
      });
      await applyStockEffect(String(created._id), def.opening);
    }
    materials.push(created);
  }
  const matByName = new Map(materials.map((m) => [m.name, m]));
  console.log("Materials: 10");

  // --- Labour ---
  const labourDefs: {
    name: string;
    phone: string;
    skill: string;
    daily: number;
    hourly: number;
    site: (typeof main) | null;
    active: boolean;
  }[] = [
    { name: "Ramesh Kumar", phone: "98765 10001", skill: "Mason", daily: 900, hourly: 120, site: main, active: true },
    { name: "Suresh Yadav", phone: "98765 10002", skill: "Helper", daily: 600, hourly: 80, site: main, active: true },
    { name: "Mahesh Patel", phone: "98765 10003", skill: "Carpenter", daily: 950, hourly: 130, site: main, active: true },
    { name: "Deepak Joshi", phone: "98765 10004", skill: "Painter", daily: 850, hourly: 110, site: main, active: true },
    { name: "Rajesh Thakor", phone: "98765 10005", skill: "Helper", daily: 600, hourly: 80, site: parking, active: true },
    { name: "Sanjay Patel", phone: "98765 10006", skill: "Operator", daily: 1100, hourly: 150, site: parking, active: true },
    { name: "Vikram Singh", phone: "98765 10007", skill: "Mason", daily: 900, hourly: 120, site: boundary, active: true },
    { name: "Anil Kumar", phone: "98765 10008", skill: "General Labour", daily: 650, hourly: 85, site: boundary, active: true },
    { name: "Arjun Rathod", phone: "98765 10009", skill: "Electrician", daily: 1000, hourly: 140, site: towerA, active: true },
    { name: "Kiran Desai", phone: "98765 10010", skill: "Plumber", daily: 1000, hourly: 140, site: towerA, active: true },
    { name: "Sunil Sharma", phone: "98765 10011", skill: "Mason", daily: 900, hourly: 120, site: towerA, active: true },
    { name: "Manoj Verma", phone: "98765 10012", skill: "Welder", daily: 950, hourly: 130, site: towerB, active: true },
    { name: "Prakash Nair", phone: "98765 10013", skill: "Helper", daily: 600, hourly: 80, site: towerB, active: true },
    { name: "Kishan Lal", phone: "98765 10014", skill: "Carpenter", daily: 950, hourly: 130, site: towerB, active: true },
    { name: "Raju Bhai", phone: "98765 10015", skill: "Helper", daily: 550, hourly: 75, site: null, active: false },
  ];
  const labourers = [];
  for (const [i, def] of labourDefs.entries()) {
    const joining = daysAgo(45 - i);
    const created = await Labour.create({
      name: def.name,
      phone: def.phone,
      photo: null,
      skill: def.skill,
      dailyRate: def.daily,
      hourlyRate: def.hourly,
      joiningDate: joining,
      status: def.active ? "active" : "inactive",
      ...(def.site ? { assignedSite: def.site._id } : {}),
      notes: null,
    });
    if (def.site) {
      await LabourAssignment.create({ labour: created._id, site: def.site._id, from: joining });
    }
    labourers.push(created);
  }
  console.log("Labourers: 15");

  // --- Attendance: last 7 days for active labour ---
  const activeLabour = labourers.filter((l) => l.status === "active");
  let attCount = 0;
  for (let d = 6; d >= 0; d--) {
    const date = daysAgo(d);
    for (const w of activeLabour) {
      if (!w.assignedSite) continue;
      const site = w.assignedSite;
      const r = rand();
      const status: "present" | "half-day" | "absent" | "leave" =
        r < 0.85 ? "present" : r < 0.9 ? "half-day" : r < 0.95 ? "absent" : "leave";
      const ot = status === "present" && rand() < 0.25 ? 1 + Math.floor(rand() * 2) : 0;
      await Attendance.create({
        labour: w._id,
        site,
        project: siteProject.get(String(site)) ?? farmhouse._id,
        date,
        status,
        checkIn: status === "present" || status === "half-day" ? "09:00" : null,
        checkOut: status === "present" ? "18:00" : null,
        overtimeHours: ot,
        notes: null,
      });
      attCount++;
    }
  }
  console.log(`Attendance: ${attCount} records`);

  // --- Overtime records ---
  const ramesh = labourers[0];
  const arjun = labourers[8];
  await Overtime.create([
    { labour: ramesh._id, site: main._id, project: patel._id, date: daysAgo(2), hours: 2, rate: 150, amount: 300, notes: "Slab overtime" },
    { labour: arjun._id, site: towerA._id, project: shree._id, date: daysAgo(1), hours: 3, rate: 140, amount: 420, notes: "Wiring overtime" },
    { labour: ramesh._id, site: main._id, project: patel._id, date: daysAgo(5), hours: 1.5, rate: 150, amount: 225, notes: null },
  ]);
  console.log("Overtime: 3 records");

  // --- Advances (inside current month) ---
  const suresh = labourers[1];
  await LabourAdvance.create([
    { labour: ramesh._id, site: main._id, date: daysAgo(3), amount: 5000, reason: "Family function", notes: null },
    { labour: suresh._id, site: main._id, date: daysAgo(5), amount: 2000, reason: null, notes: null },
    { labour: arjun._id, site: towerA._id, date: daysAgo(2), amount: 3000, reason: "Advance", notes: null },
  ]);
  console.log("Advances: 3");

  // --- Salaries for current month ---
  const monthStart = new Date();
  monthStart.setDate(1);
  const startStr = monthStart.toISOString().slice(0, 10);
  const endStr = new Date().toISOString().slice(0, 10);
  for (const w of activeLabour) {
    await computeAndSaveSalary({
      labourId: String(w._id),
      periodStart: startStr,
      periodEnd: endStr,
    });
  }
  // Demo payment states: Ramesh fully paid, Suresh partially.
  const rameshSalary = await Salary.findOne({ labour: ramesh._id });
  if (rameshSalary) {
    rameshSalary.paidAmount = rameshSalary.net;
    rameshSalary.status = deriveSalaryStatus(rameshSalary.net, rameshSalary.paidAmount);
    await rameshSalary.save();
  }
  const sureshSalary = await Salary.findOne({ labour: suresh._id });
  if (sureshSalary && sureshSalary.net > 2000) {
    sureshSalary.paidAmount = 2000;
    sureshSalary.status = deriveSalaryStatus(sureshSalary.net, 2000);
    await sureshSalary.save();
  }
  console.log(`Salaries: ${activeLabour.length} computed`);

  // --- Purchases + consumption ---
  async function purchase(
    materialName: string,
    qty: number,
    rate: number,
    site: typeof main,
    ago: number,
    supplier: string,
    invoice: string,
  ) {
    const m = matByName.get(materialName);
    if (!m) throw new Error(`Missing material ${materialName}`);
    const created = await StockTransaction.create({
      material: m._id,
      project: siteProject.get(String(site._id)),
      site: site._id,
      date: daysAgo(ago),
      type: "purchase",
      quantity: qty,
      unit: m.unit,
      rate,
      total: Math.round(qty * rate),
      supplier,
      invoiceNumber: invoice,
      notes: null,
    });
    await applyStockEffect(String(m._id), stockEffect("purchase", qty));
    return created;
  }
  async function consume(materialName: string, qty: number, site: typeof main, ago: number, purpose: string) {
    const m = matByName.get(materialName);
    if (!m) throw new Error(`Missing material ${materialName}`);
    const created = await StockTransaction.create({
      material: m._id,
      project: siteProject.get(String(site._id)),
      site: site._id,
      date: daysAgo(ago),
      type: "consumption",
      quantity: qty,
      unit: m.unit,
      rate: 0,
      total: 0,
      purpose,
      notes: null,
    });
    await applyStockEffect(String(m._id), stockEffect("consumption", qty));
    return created;
  }
  await purchase("Cement (UltraTech)", 100, 380, main, 12, "Shree Traders", "INV-1001");
  await purchase("Steel 12mm", 500, 62, towerA, 10, "Steel Point", "INV-1002");
  await purchase("River Sand", 200, 45, main, 8, "Shree Traders", "INV-1003");
  await purchase("Red Bricks", 5000, 9, boundary, 6, "Local Kiln", "INV-1004");
  await purchase("Asian Paints", 40, 320, main, 4, "Color World", "INV-1005");
  await purchase("Cement (UltraTech)", 50, 385, towerB, 2, "Shree Traders", "INV-1006");
  await consume("Cement (UltraTech)", 20, main, 5, "Slab work");
  await consume("Cement (UltraTech)", 20, main, 4, "Slab work");
  await consume("Cement (UltraTech)", 15, main, 2, "Plaster");
  await consume("Steel 12mm", 120, towerA, 3, "Column casting");
  await consume("River Sand", 60, main, 4, "Mortar");
  await consume("Red Bricks", 1500, boundary, 5, "Wall masonry");
  console.log("Stock transactions: 12 + openings");

  // --- Expenses ---
  await Expense.create([
    { project: patel._id, site: main._id, date: daysAgo(4), category: "Transport", description: "Diesel for mixer", amount: 2500, vendor: "HP Petrol Pump", paymentMethod: "Cash", notes: null },
    { project: patel._id, site: main._id, date: daysAgo(7), category: "Equipment", description: "Mixer machine rent — 1 week", amount: 8000, vendor: "Shree Equipments", paymentMethod: "UPI", notes: null },
    { project: shree._id, site: towerA._id, date: daysAgo(9), category: "Contractor", description: "RCC contractor part payment", amount: 45000, vendor: "SK Contractors", paymentMethod: "Bank Transfer", reference: "NEFT-8821", notes: null },
    { project: patel._id, site: null, date: daysAgo(6), category: "Transport", description: "Sand truck freight", amount: 3500, vendor: null, paymentMethod: "Cash", notes: null },
    { project: shree._id, site: null, date: daysAgo(11), category: "Electricity", description: "Site electricity bill", amount: 1800, vendor: "Torrent Power", paymentMethod: "UPI", notes: null },
  ]);
  console.log("Expenses: 5");

  // --- Client payments ---
  await ClientPayment.create([
    { project: patel._id, date: daysAgo(20), amount: 1000000, paymentMethod: "UPI", reference: "UPI-551", notes: "First installment" },
    { project: patel._id, date: daysAgo(6), amount: 1000000, paymentMethod: "Bank Transfer", reference: "NEFT-9021", notes: "Second installment" },
    { project: shree._id, date: daysAgo(9), amount: 1500000, paymentMethod: "Bank Transfer", reference: "NEFT-8840", notes: "Mobilization advance" },
  ]);
  console.log("Client payments: 3");

  console.log("\nSeed complete. Open the dashboard to see live figures.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
