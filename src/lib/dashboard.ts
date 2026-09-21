import { Project } from "@/models/Project";
import { Site } from "@/models/Site";
import { Labour } from "@/models/Labour";
import { Attendance } from "@/models/Attendance";
import { Overtime } from "@/models/Overtime";
import { Salary } from "@/models/Salary";
import { Material } from "@/models/Material";
import { StockTransaction } from "@/models/StockTransaction";
import { Expense } from "@/models/Expense";
import { ClientPayment } from "@/models/ClientPayment";
import { getProjectFinance } from "@/lib/finance";
import { formatDateShort } from "@/lib/utils";

export interface DashboardSummary {
  activeProjects: number;
  activeSites: number;
  totalLabour: number;
  activeLabour: number;
  today: {
    date: Date;
    present: number;
    absent: number;
    half: number;
    leave: number;
    total: number;
    overtimeHours: number;
  };
  todayPurchases: number;
  todayExpenses: number;
  pendingLabourPayments: number;
  monthExpenses: number;
  receivedTotal: number;
  outstandingTotal: number;
  profitTotal: number;
  lowStockCount: number;
  lowStock: { _id: string; name: string; currentStock: number; minimumStock: number; unit: string }[];
  recentActivity: { at: Date; text: string }[];
  monthlyExpenses: { month: string; amount: number }[];
  projects: {
    _id: string;
    name: string;
    clientName: string;
    location: string;
    progress: number;
    budget: number;
    expense: number;
    remaining: number;
    status: string;
  }[];
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function startOfMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7); // yyyy-mm
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-IN", {
    month: "short",
    timeZone: "UTC",
  });
}

export async function getMonthlyExpenses(months = 6): Promise<{ month: string; amount: number }[]> {
  const since = new Date(startOfMonth());
  since.setUTCMonth(since.getUTCMonth() - (months - 1));
  const [manual, purchases] = await Promise.all([
    Expense.aggregate([
      { $match: { date: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$date" } }, amount: { $sum: "$amount" } } },
    ]),
    StockTransaction.aggregate([
      { $match: { type: "purchase", date: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$date" } }, amount: { $sum: "$total" } } },
    ]),
  ]);
  const totals: Record<string, number> = {};
  for (const row of [...manual, ...purchases] as { _id: string; amount: number }[]) {
    totals[row._id] = (totals[row._id] ?? 0) + row.amount;
  }
  const keys: string[] = [];
  const cursor = new Date(since);
  for (let i = 0; i < months; i++) {
    keys.push(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return keys.map((k) => ({ month: monthLabel(k), amount: Math.round(totals[k] ?? 0) }));
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const today = startOfToday();
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const monthStart = startOfMonth();
  const todayFilter = { $gte: today, $lt: tomorrow };
  const monthFilter = { $gte: monthStart };

  const [
    activeProjects,
    activeSites,
    totalLabour,
    activeLabour,
    todayAgg,
    todayPurchaseAgg,
    todayExpenseAgg,
    salaryPayableAgg,
    monthManualAgg,
    monthPurchaseAgg,
    contractAgg,
    receivedAgg,
    purchaseTotalAgg,
    attendanceCostAgg,
    overtimeTotalAgg,
    manualTotalAgg,
    lowStock,
    activeProjectDocs,
  ] = await Promise.all([
    Project.countDocuments({ status: "active" }),
    Site.countDocuments({ status: "active" }),
    Labour.countDocuments(),
    Labour.countDocuments({ status: "active" }),
    Attendance.aggregate([
      { $match: { date: todayFilter } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          ot: { $sum: "$overtimeHours" },
        },
      },
    ]),
    StockTransaction.aggregate([
      { $match: { type: "purchase", date: todayFilter } },
      { $group: { _id: null, amount: { $sum: "$total" } } },
    ]),
    Expense.aggregate([
      { $match: { date: todayFilter } },
      { $group: { _id: null, amount: { $sum: "$amount" } } },
    ]),
    Salary.aggregate([
      { $match: { status: { $in: ["pending", "partially-paid"] } } },
      { $group: { _id: null, balance: { $sum: { $subtract: ["$net", "$paidAmount"] } } } },
    ]),
    Expense.aggregate([
      { $match: { date: monthFilter } },
      { $group: { _id: null, amount: { $sum: "$amount" } } },
    ]),
    StockTransaction.aggregate([
      { $match: { type: "purchase", date: monthFilter } },
      { $group: { _id: null, amount: { $sum: "$total" } } },
    ]),
    Project.aggregate([{ $group: { _id: null, amount: { $sum: "$contractValue" } } }]),
    ClientPayment.aggregate([{ $group: { _id: null, amount: { $sum: "$amount" } } }]),
    StockTransaction.aggregate([
      { $match: { type: "purchase" } },
      { $group: { _id: null, amount: { $sum: "$total" } } },
    ]),
      Attendance.aggregate([
        {
          $lookup: {
            // Model-derived: "Labour" pluralizes to "labour", not "labours".
            from: Labour.collection.name,
            localField: "labour",
            foreignField: "_id",
            as: "worker",
          },
        },
      { $unwind: "$worker" },
      {
        $group: {
          _id: null,
          cost: {
            $sum: {
              $add: [
                { $cond: [{ $eq: ["$status", "present"] }, "$worker.dailyRate", 0] },
                {
                  $cond: [
                    { $eq: ["$status", "half-day"] },
                    { $multiply: ["$worker.dailyRate", 0.5] },
                    0,
                  ],
                },
                { $multiply: ["$overtimeHours", "$worker.hourlyRate"] },
              ],
            },
          },
        },
      },
    ]),
    Overtime.aggregate([{ $group: { _id: null, amount: { $sum: "$amount" } } }]),
    Expense.aggregate([{ $group: { _id: null, amount: { $sum: "$amount" } } }]),
    Material.find({ $expr: { $lte: ["$currentStock", "$minimumStock"] } })
      .sort({ currentStock: 1 })
      .limit(5)
      .select("name currentStock minimumStock unit")
      .lean(),
    Project.find({ status: "active" }).sort({ updatedAt: -1 }).limit(6).lean(),
  ]);

  const byStatus: Record<string, { count: number; ot: number }> = {};
  for (const row of todayAgg as { _id: string; count: number; ot: number }[]) {
    byStatus[row._id] = row;
  }
  const present = byStatus.present?.count ?? 0;
  const absent = byStatus.absent?.count ?? 0;
  const half = byStatus["half-day"]?.count ?? 0;
  const leave = byStatus.leave?.count ?? 0;

  const contracts = contractAgg[0]?.amount ?? 0;
  const received = receivedAgg[0]?.amount ?? 0;
  const allCosts =
    (purchaseTotalAgg[0]?.amount ?? 0) +
    Math.round(attendanceCostAgg[0]?.cost ?? 0) +
    (overtimeTotalAgg[0]?.amount ?? 0) +
    (manualTotalAgg[0]?.amount ?? 0);

  const [recentAttendance, recentPurchases, recentPayments, recentExpenses] =
    await Promise.all([
      Attendance.find({})
        .populate("labour", "name")
        .populate("site", "name")
        .sort({ createdAt: -1 })
        .limit(6)
        .lean(),
      StockTransaction.find({ type: "purchase" })
        .populate("material", "name")
        .populate("site", "name")
        .sort({ createdAt: -1 })
        .limit(3)
        .lean(),
      ClientPayment.find({})
        .populate("project", "name")
        .sort({ createdAt: -1 })
        .limit(3)
        .lean(),
      Expense.find({})
        .sort({ createdAt: -1 })
        .limit(3)
        .lean(),
    ]);

  const activity: { at: Date; text: string }[] = [
    ...recentAttendance.map((a) => ({
      at: a.createdAt,
      text: `${nameOf(a.labour)} marked ${a.status} at ${nameOf(a.site)} · ${formatDateShort(a.date)}`,
    })),
    ...recentPurchases.map((p) => ({
      at: p.createdAt,
      text: `${nameOf(p.material)} purchase ₹${p.total.toLocaleString("en-IN")} at ${nameOf(p.site)}`,
    })),
    ...recentPayments.map((p) => ({
      at: p.createdAt,
      text: `Client payment ₹${p.amount.toLocaleString("en-IN")} received (${nameOf(p.project)})`,
    })),
    ...recentExpenses.map((e) => ({
      at: e.createdAt,
      text: `${e.category} expense ₹${e.amount.toLocaleString("en-IN")} — ${e.description}`,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 8);

  const monthlyExpenses = await getMonthlyExpenses(6);

  const projects = await Promise.all(
    activeProjectDocs.map(async (p) => {
      const f = await getProjectFinance(String(p._id));
      return {
        _id: String(p._id),
        name: p.name,
        clientName: p.clientName,
        location: p.location,
        progress: p.progress,
        budget: p.budget,
        expense: f.totalExpense,
        remaining: p.budget - f.totalExpense,
        status: p.status,
      };
    }),
  );

  return {
    activeProjects,
    activeSites,
    totalLabour,
    activeLabour,
    today: {
      date: today,
      present,
      absent,
      half,
      leave,
      total: present + absent + half + leave,
      overtimeHours: Object.values(byStatus).reduce((s, r) => s + (r.ot ?? 0), 0),
    },
    todayPurchases: todayPurchaseAgg[0]?.amount ?? 0,
    todayExpenses: todayExpenseAgg[0]?.amount ?? 0,
    pendingLabourPayments: Math.round(salaryPayableAgg[0]?.balance ?? 0),
    monthExpenses:
      Math.round(monthManualAgg[0]?.amount ?? 0) + Math.round(monthPurchaseAgg[0]?.amount ?? 0),
    receivedTotal: received,
    outstandingTotal: contracts - received,
    profitTotal: contracts - allCosts,
    lowStockCount: lowStock.length,
    lowStock: lowStock.map((m) => ({
      _id: String(m._id),
      name: m.name,
      currentStock: m.currentStock,
      minimumStock: m.minimumStock,
      unit: m.unit,
    })),
    recentActivity: activity,
    monthlyExpenses,
    projects,
  };
}

function nameOf(ref: unknown): string {
  if (!ref || typeof ref === "string") return String(ref ?? "—");
  if (typeof ref === "object" && "name" in ref) return String((ref as { name: unknown }).name);
  return "—";
}

export interface LabourReport {
  total: number;
  active: number;
  bySkill: { skill: string; count: number }[];
  payable: number;
  paid: number;
  balance: number;
}

export async function getLabourReport(): Promise<LabourReport> {
  const [total, active, bySkill, salary] = await Promise.all([
    Labour.countDocuments(),
    Labour.countDocuments({ status: "active" }),
    Labour.aggregate([
      { $group: { _id: "$skill", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Salary.aggregate([
      {
        $group: {
          _id: null,
          net: { $sum: "$net" },
          paid: { $sum: "$paidAmount" },
        },
      },
    ]),
  ]);
  const net = salary[0]?.net ?? 0;
  const paid = salary[0]?.paid ?? 0;
  return {
    total,
    active,
    bySkill: (bySkill as { _id: string; count: number }[]).map((r) => ({
      skill: r._id,
      count: r.count,
    })),
    payable: net,
    paid,
    balance: net - paid,
  };
}

export interface ExpenseReport {
  byCategory: { category: string; amount: number }[];
  byProject: { project: string; amount: number }[];
  monthly: { month: string; amount: number }[];
}

export async function getExpenseReport(): Promise<ExpenseReport> {
  const [byCategory, byProject, monthly] = await Promise.all([
    Expense.aggregate([
      { $group: { _id: "$category", amount: { $sum: "$amount" } } },
      { $sort: { amount: -1 } },
    ]),
    Expense.aggregate([
      {
        $lookup: {
          from: Project.collection.name,
          localField: "project",
          foreignField: "_id",
          as: "proj",
        },
      },
      { $unwind: { path: "$proj", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ["$proj.name", "General"] },
          amount: { $sum: "$amount" },
        },
      },
      { $sort: { amount: -1 } },
    ]),
    getMonthlyExpenses(6),
  ]);
  return {
    byCategory: (byCategory as { _id: string; amount: number }[]).map((r) => ({
      category: r._id,
      amount: r.amount,
    })),
    byProject: (byProject as { _id: string; amount: number }[]).map((r) => ({
      project: r._id,
      amount: r.amount,
    })),
    monthly,
  };
}

export interface StockReport {
  materials: { _id: string; name: string; unit: string; stock: number; min: number; low: boolean }[];
  lowCount: number;
  last30Days: { purchased: number; consumed: number };
}

export async function getStockReport(): Promise<StockReport> {
  const since = new Date(startOfToday());
  since.setUTCDate(since.getUTCDate() - 30);
  const [materials, movement] = await Promise.all([
    Material.find({}).sort({ name: 1 }).select("name unit currentStock minimumStock").lean(),
    StockTransaction.aggregate([
      { $match: { date: { $gte: since } } },
      {
        $group: {
          _id: "$type",
          quantity: { $sum: "$quantity" },
        },
      },
    ]),
  ]);
  const byType: Record<string, number> = {};
  for (const row of movement as { _id: string; quantity: number }[]) {
    byType[row._id] = (byType[row._id] ?? 0) + row.quantity;
  }
  return {
    materials: materials.map((m) => ({
      _id: String(m._id),
      name: m.name,
      unit: m.unit,
      stock: m.currentStock,
      min: m.minimumStock,
      low: m.currentStock <= m.minimumStock,
    })),
    lowCount: materials.filter((m) => m.currentStock <= m.minimumStock).length,
    last30Days: {
      purchased: byType.purchase ?? 0,
      consumed: Math.abs(byType.consumption ?? 0),
    },
  };
}

export interface ProjectFinancialRow {
  _id: string;
  name: string;
  clientName: string;
  status: string;
  contractValue: number;
  budget: number;
  expense: number;
  received: number;
  pending: number;
  profit: number;
}

export async function getProjectFinancialReport(): Promise<ProjectFinancialRow[]> {
  const projects = await Project.find({}).sort({ updatedAt: -1 }).lean();
  return Promise.all(
    projects.map(async (p) => {
      const f = await getProjectFinance(String(p._id));
      return {
        _id: String(p._id),
        name: p.name,
        clientName: p.clientName,
        status: p.status,
        contractValue: f.contractValue,
        budget: f.budget,
        expense: f.totalExpense,
        received: f.received,
        pending: f.pending,
        profit: f.profit,
      };
    }),
  );
}
