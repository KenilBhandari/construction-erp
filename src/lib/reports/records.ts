import { Attendance } from "@/models/Attendance";
import { Overtime } from "@/models/Overtime";
import { StockTransaction } from "@/models/StockTransaction";
import { Expense } from "@/models/Expense";
import { dateMatch, idMatch, type ReportScope } from "@/lib/reports/scope";
import { REPORT_PAGE_SIZE } from "@/lib/reports/project-runner";

const nameOf = (ref: unknown): string =>
  ref && typeof ref === "object" && "name" in ref ? String((ref as { name: unknown }).name) : "—";

export interface AttendanceRecord {
  _id: string;
  date: Date;
  workerName: string;
  projectName: string;
  siteName: string;
  status: string;
  otHours: number;
}

/** Scoped attendance history — server-paginated, 100/page (pageSize override for PDF). */
export async function getAttendanceRecords(
  scope: Pick<ReportScope, "from" | "to" | "projectId" | "siteId"> & { labourId?: string },
  page = 1,
  pageSize = REPORT_PAGE_SIZE,
): Promise<{ rows: AttendanceRecord[]; total: number }> {
  const match = {
    ...dateMatch(scope),
    ...idMatch("project", scope?.projectId),
    ...idMatch("site", scope?.siteId),
    ...idMatch("labour", scope?.labourId),
  };
  const [rows, total] = await Promise.all([
    Attendance.find(match)
      .populate("labour", "name")
      .populate("project", "name")
      .populate("site", "name")
      .sort({ date: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Attendance.countDocuments(match),
  ]);
  return {
    rows: rows.map((a) => ({
      _id: String(a._id),
      date: a.date as Date,
      workerName: nameOf(a.labour),
      projectName: nameOf(a.project),
      siteName: nameOf(a.site),
      status: a.status as string,
      otHours: (a.overtimeHours as number | undefined) ?? 0,
    })),
    total,
  };
}

export interface ExpenseRecord {
  _id: string;
  date: Date;
  projectName: string;
  siteName: string;
  category: string;
  description: string;
  amount: number;
}

/** Scoped expense history — server-paginated, 100/page (pageSize override for PDF). */
export async function getExpenseRecords(
  scope: Pick<ReportScope, "from" | "to" | "projectId" | "siteId"> & { category?: string },
  page = 1,
  pageSize = REPORT_PAGE_SIZE,
): Promise<{ rows: ExpenseRecord[]; total: number }> {
  const match = {
    ...dateMatch(scope),
    ...idMatch("project", scope?.projectId),
    ...idMatch("site", scope?.siteId),
    ...(scope?.category ? { category: scope.category } : {}),
  };
  const [rows, total] = await Promise.all([
    Expense.find(match)
      .populate("project", "name")
      .populate("site", "name")
      .sort({ date: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Expense.countDocuments(match),
  ]);
  return {
    rows: rows.map((e) => ({
      _id: String(e._id),
      date: e.date as Date,
      projectName: nameOf(e.project),
      siteName: nameOf(e.site),
      category: e.category as string,
      description: e.description as string,
      amount: e.amount as number,
    })),
    total,
  };
}

export interface StockRecord {
  _id: string;
  date: Date;
  materialName: string;
  type: string;
  quantity: number;
  siteName: string;
}

/** Scoped stock-transaction history — server-paginated, 100/page (pageSize override for PDF). */
export async function getStockRecords(
  scope: Pick<ReportScope, "from" | "to" | "projectId" | "siteId"> & { materialId?: string },
  page = 1,
  pageSize = REPORT_PAGE_SIZE,
): Promise<{ rows: StockRecord[]; total: number }> {
  const match = {
    ...dateMatch(scope),
    ...idMatch("project", scope?.projectId),
    ...idMatch("site", scope?.siteId),
    ...idMatch("material", scope?.materialId),
  };
  const [rows, total] = await Promise.all([
    StockTransaction.find(match)
      .populate("material", "name")
      .populate("site", "name")
      .sort({ date: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    StockTransaction.countDocuments(match),
  ]);
  return {
    rows: rows.map((t) => ({
      _id: String(t._id),
      date: t.date as Date,
      materialName: nameOf(t.material),
      type: t.type as string,
      quantity: (t.quantity as number) ?? 0,
      siteName: nameOf(t.site),
    })),
    total,
  };
}

export interface OvertimeRecord {
  _id: string;
  date: Date;
  workerName: string;
  siteName: string;
  hours: number;
  cost: number;
}

/** Scoped overtime history — server-paginated, 100/page. */
export async function getOvertimeRecords(
  scope: Pick<ReportScope, "from" | "to" | "projectId" | "siteId"> & { labourId?: string },
  page = 1,
): Promise<{ rows: OvertimeRecord[]; total: number }> {
  const match = {
    ...dateMatch(scope),
    ...idMatch("project", scope?.projectId),
    ...idMatch("site", scope?.siteId),
    ...idMatch("labour", scope?.labourId),
  };
  const [rows, total] = await Promise.all([
    Overtime.find(match)
      .populate("labour", "name")
      .populate("site", "name")
      .sort({ date: -1 })
      .skip((page - 1) * REPORT_PAGE_SIZE)
      .limit(REPORT_PAGE_SIZE)
      .lean(),
    Overtime.countDocuments(match),
  ]);
  return {
    rows: rows.map((o) => ({
      _id: String(o._id),
      date: o.date as Date,
      workerName: nameOf(o.labour),
      siteName: nameOf(o.site),
      hours: (o.hours as number) ?? 0,
      cost: (o.amount as number) ?? 0,
    })),
    total,
  };
}
