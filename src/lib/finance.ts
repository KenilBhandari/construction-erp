import { Types } from "mongoose";
import { Project } from "@/models/Project";
import { StockTransaction } from "@/models/StockTransaction";
import { Attendance } from "@/models/Attendance";
import { Overtime } from "@/models/Overtime";
import { Expense } from "@/models/Expense";
import { ClientPayment } from "@/models/ClientPayment";
import { calculatePendingPayment, calculateProjectProfit } from "@/lib/calculations";
import type { ProjectFinance } from "@/types/finance";

/**
 * Single formula for project money — derived from underlying records (§28):
 *
 *   totalExpense = material purchases + attendance labour (snapshot cost) + overtime
 *                  records + all manual expenses
 *
 * Labour cost uses historical Attendance.cost (snapshot), not current Labour rates.
 */
export async function getProjectFinance(projectId: string): Promise<ProjectFinance> {
  const project = await Project.findById(projectId).lean();
  if (!project) throw new Error("Project not found.");
  const pid = new Types.ObjectId(projectId);

  const [purchaseAgg, attendanceAgg, overtimeAgg, expenseAgg, paymentAgg] =
    await Promise.all([
      StockTransaction.aggregate([
        { $match: { project: pid, type: "purchase" } },
        { $group: { _id: null, amount: { $sum: "$total" } } },
      ]),
      Attendance.aggregate([
        { $match: { project: pid } },
        {
          $group: {
            _id: null,
            presentDays: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
            halfDays: { $sum: { $cond: [{ $eq: ["$status", "half-day"] }, 1, 0] } },
            cost: { $sum: { $ifNull: ["$cost", 0] } },
          },
        },
      ]),
      Overtime.aggregate([
        { $match: { project: pid } },
        { $group: { _id: null, amount: { $sum: "$amount" } } },
      ]),
      Expense.aggregate([
        { $match: { project: pid } },
        { $group: { _id: null, amount: { $sum: "$amount" } } },
      ]),
      ClientPayment.aggregate([
        { $match: { project: pid } },
        { $group: { _id: null, amount: { $sum: "$amount" } } },
      ]),
    ]);

  const materialExpense = purchaseAgg[0]?.amount ?? 0;
  const attendanceCost = Math.round(attendanceAgg[0]?.cost ?? 0);
  const overtimeRecords = overtimeAgg[0]?.amount ?? 0;
  const labourExpense = attendanceCost + overtimeRecords;
  const manualExpenses = expenseAgg[0]?.amount ?? 0;
  const totalExpense = materialExpense + labourExpense + manualExpenses;
  const received = paymentAgg[0]?.amount ?? 0;
  const pending = calculatePendingPayment(project.contractValue, received);
  const { profit, margin } = calculateProjectProfit(project.contractValue, totalExpense);

  return {
    contractValue: project.contractValue,
    budget: project.budget,
    materialExpense,
    labourExpense,
    labourBreakdown: {
      attendanceCost,
      overtimeRecords,
      presentDays: attendanceAgg[0]?.presentDays ?? 0,
      halfDays: attendanceAgg[0]?.halfDays ?? 0,
    },
    manualExpenses,
    totalExpense,
    received,
    pending,
    profit,
    margin,
  };
}
