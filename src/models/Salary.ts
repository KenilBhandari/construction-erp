import mongoose, { Schema, type InferSchemaType } from "mongoose";

/**
 * Computed pay for one labourer over one period. Recomputing the same
 * (labour, period) upserts — breakdown fields make every figure auditable.
 * `status` is derived from paidAmount vs net, never set directly.
 *
 * Phase 3: advanceRecovery is explicit contractor-chosen recovery for this
 * settlement (0 allowed). Advances are never auto-deducted by date.
 */
const SalarySchema = new Schema(
  {
    labour: {
      type: Schema.Types.ObjectId,
      ref: "Labour",
      required: true,
      index: true,
    },
    // Attribution for reporting; historical assignment remains in LabourAssignment.
    site: {
      type: Schema.Types.ObjectId,
      ref: "Site",
      default: null,
      index: true,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      default: null,
      index: true,
    },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    presentDays: { type: Number, min: 0, default: 0 },
    halfDays: { type: Number, min: 0, default: 0 },
    absentDays: { type: Number, min: 0, default: 0 },
    leaveDays: { type: Number, min: 0, default: 0 },
    overtimeHours: { type: Number, min: 0, default: 0 },
    overtimeRecordsAmount: { type: Number, min: 0, default: 0 },
    gross: { type: Number, default: 0 },
    overtimeAmount: { type: Number, default: 0 },
    advanceRecovery: { type: Number, min: 0, default: 0 },
    deductions: { type: Number, min: 0, default: 0 },
    net: { type: Number, default: 0 },
    paidAmount: { type: Number, min: 0, default: 0 },
    paymentMethod: { type: String, default: null },
    paymentReference: { type: String, default: null },
    status: {
      type: String,
      enum: ["pending", "partially-paid", "paid"],
      default: "pending",
      index: true,
    },
    notes: { type: String, default: null },
  },
  { timestamps: true },
);

SalarySchema.index({ labour: 1, periodStart: 1, periodEnd: 1 }, { unique: true });

export type SalaryDoc = InferSchemaType<typeof SalarySchema> & {
  _id: mongoose.Types.ObjectId;
};

// Hot-reload safety: Phase 1-5 added site/project/advanceRecovery. If dev server
// still holds an old compiled model without those paths, delete it so the new
// schema takes effect instead of throwing "Cannot populate path `site`".
const _existingSalary = mongoose.models.Salary as mongoose.Model<SalaryDoc> | undefined;
if (_existingSalary) {
  const p: unknown = _existingSalary.schema.path("site");
  const pp: unknown = _existingSalary.schema.path("project");
  const ar: unknown = _existingSalary.schema.path("advanceRecovery");
  if (!p || !pp || !ar) {
    delete (mongoose.models as Record<string, unknown>).Salary;
  }
}

export const Salary =
  (mongoose.models.Salary as mongoose.Model<SalaryDoc> | undefined) ??
  mongoose.model<SalaryDoc>("Salary", SalarySchema);
