import { Labour } from "@/models/Labour";
import { Attendance } from "@/models/Attendance";
import { Overtime } from "@/models/Overtime";
import { dateMatch, idMatch, type ReportScope } from "@/lib/reports/scope";
import { getSalaryAnalysis } from "@/lib/reports/salary";
import { getBulkAdvanceSummaries } from "@/lib/advances";
import { getAttendanceRecords, type AttendanceRecord } from "@/lib/reports/records";
import { REPORT_PAGE_SIZE } from "@/lib/reports/project-runner";

export interface LabourReportDetail {
  header: { labourId: string; name: string; skill: string };
  attendance: { present: number; half: number; absent: number; leave: number; otHours: number };
  cost: { earned: number; overtime: number; total: number };
  salary: { paid: number; outstanding: number };
  advanceOutstanding: number;
  history: { rows: AttendanceRecord[]; total: number };
  generatedAt: Date;
}

/**
 * Labour runner — what one worker did and cost over time.
 * Earnings aggregate Attendance/Overtime directly (canonical labour rule);
 * Salary contributes paid/outstanding only (worker/period sums).
 */
export async function getLabourReportDetail(
  scope: Pick<ReportScope, "from" | "to" | "projectId" | "siteId"> & {
    labourId?: string;
    page?: number;
    pageSize?: number;
  },
): Promise<LabourReportDetail> {
  if (!scope.labourId) throw new Error("Worker is required for this report.");
  const worker = await Labour.findById(scope.labourId).lean();
  if (!worker) throw new Error("Worker not found.");
  const match = {
    ...dateMatch(scope),
    ...idMatch("project", scope?.projectId),
    ...idMatch("site", scope?.siteId),
    ...idMatch("labour", scope.labourId),
  };

  const [attAgg, otAgg, salaryRows, advanceMap, history] = await Promise.all([
    Attendance.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
          half: { $sum: { $cond: [{ $eq: ["$status", "half-day"] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
          leave: { $sum: { $cond: [{ $eq: ["$status", "leave"] }, 1, 0] } },
          otHours: { $sum: { $ifNull: ["$overtimeHours", 0] } },
          earned: { $sum: { $ifNull: ["$cost", 0] } },
        },
      },
    ]),
    Overtime.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          hours: { $sum: "$hours" },
          amount: { $sum: "$amount" },
        },
      },
    ]),
    getSalaryAnalysis({ from: scope.from, to: scope.to, labourId: scope.labourId }),
    getBulkAdvanceSummaries([scope.labourId]),
    getAttendanceRecords(scope, scope.page ?? 1, scope.pageSize ?? REPORT_PAGE_SIZE),
  ]);

  const att = attAgg[0] ?? { present: 0, half: 0, absent: 0, leave: 0, otHours: 0, earned: 0 };
  const earned = Math.round(att.earned ?? 0);
  const overtime = (otAgg[0]?.amount as number | undefined) ?? 0;
  const paid = salaryRows.reduce((s, r) => s + r.paid, 0);
  const salaryOutstanding = salaryRows.reduce((s, r) => s + r.outstanding, 0);

  return {
    header: {
      labourId: scope.labourId,
      name: (worker.name as string) ?? "—",
      skill: ((worker.skill as string | undefined) ?? "").trim() || "—",
    },
    attendance: {
      present: att.present ?? 0,
      half: att.half ?? 0,
      absent: att.absent ?? 0,
      leave: att.leave ?? 0,
      otHours: Math.round(((att.otHours as number) ?? 0) * 10) / 10,
    },
    cost: { earned, overtime, total: earned + overtime },
    salary: { paid, outstanding: salaryOutstanding },
    advanceOutstanding: advanceMap.get(scope.labourId)?.outstanding ?? 0,
    history,
    generatedAt: new Date(),
  };
}
