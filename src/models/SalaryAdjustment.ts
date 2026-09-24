import mongoose, { Schema, type InferSchemaType } from "mongoose";

/**
 * Audit trail for corrections after salary is partially-paid/paid (§19).
 * Never silently mutate frozen settlements — create an adjustment instead.
 */
const SalaryAdjustmentSchema = new Schema(
  {
    salary: { type: Schema.Types.ObjectId, ref: "Salary", required: true, index: true },
    labour: { type: Schema.Types.ObjectId, ref: "Labour", required: true, index: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    deltaGross: { type: Number, required: true },
    deltaOvertime: { type: Number, required: true },
    deltaNet: { type: Number, required: true },
    reason: { type: String, required: true, trim: true },
    attendanceIds: [{ type: Schema.Types.ObjectId, ref: "Attendance" }],
    overtimeIds: [{ type: Schema.Types.ObjectId, ref: "Overtime" }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    notes: { type: String, default: null },
    idempotencyKey: { type: String, select: false },
  },
  { timestamps: true },
);

SalaryAdjustmentSchema.index({ salary: 1, createdAt: -1 });
SalaryAdjustmentSchema.index({ labour: 1, periodStart: 1, periodEnd: 1 });
SalaryAdjustmentSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

export type SalaryAdjustmentDoc = InferSchemaType<typeof SalaryAdjustmentSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const SalaryAdjustment =
  (mongoose.models.SalaryAdjustment as mongoose.Model<SalaryAdjustmentDoc> | undefined) ??
  mongoose.model<SalaryAdjustmentDoc>("SalaryAdjustment", SalaryAdjustmentSchema);
