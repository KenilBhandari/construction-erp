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
    remainingAmount: { type: Number, min: 0, default: 0 },
    paymentMethod: { type: String, default: null },
    paymentReference: { type: String, default: null },
    status: {
      type: String,
      enum: ["pending", "partially-paid", "paid"],
      default: "pending",
      index: true,
    },
    notes: { type: String, default: null },
    // Historical snapshots for audit
    snapshotDailyRate: { type: Number, min: 0, default: null },
    snapshotHourlyRate: { type: Number, min: 0, default: null },
    // Multi-site earnings breakdown (§10-12)
    earningsBreakdown: {
      type: [
        new Schema(
          {
            site: { type: Schema.Types.ObjectId, ref: "Site", default: null },
            project: { type: Schema.Types.ObjectId, ref: "Project", default: null },
            presentDays: { type: Number, min: 0, default: 0 },
            halfDays: { type: Number, min: 0, default: 0 },
            gross: { type: Number, min: 0, default: 0 },
            overtimeAmount: { type: Number, min: 0, default: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    idempotencyKey: { type: String },
    needsReconciliation: { type: Boolean, default: false },
  },
  { timestamps: true },
);

SalarySchema.index({ labour: 1, periodStart: 1, periodEnd: 1 }, { unique: true });
SalarySchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
SalarySchema.index({ needsReconciliation: 1 });

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
  const rem: unknown = _existingSalary.schema.path("remainingAmount");
  const eb: unknown = _existingSalary.schema.path("earningsBreakdown");
  const idk: unknown = _existingSalary.schema.path("idempotencyKey");
  if (!p || !pp || !ar || !rem || !eb || !idk) {
    delete (mongoose.models as Record<string, unknown>).Salary;
  }
}

export const Salary =
  (mongoose.models.Salary as mongoose.Model<SalaryDoc> | undefined) ??
  mongoose.model<SalaryDoc>("Salary", SalarySchema);
