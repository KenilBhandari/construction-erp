import mongoose, { Schema, type InferSchemaType } from "mongoose";

/**
 * Computed pay for one labourer over one period. Recomputing the same
 * (labour, period) upserts — breakdown fields make every figure auditable.
 * `status` is derived from paidAmount vs net, never set directly.
 *
 * Phase 1: advanceRecovery is canonical (explicit recovery chosen per settlement).
 * `advances` is retained for backward compat and kept in sync (do not diverge).
 */
const SalarySchema = new Schema(
  {
    labour: {
      type: Schema.Types.ObjectId,
      ref: "Labour",
      required: true,
      index: true,
    },
    // Optional site/project attribution for reporting; not a second assignment system.
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
    // Canonical explicit recovery for this settlement (§2-3). Not auto-deducted.
    advanceRecovery: { type: Number, min: 0, default: 0 },
    // Legacy alias — kept in sync with advanceRecovery for backward compat.
    advances: { type: Number, min: 0, default: 0 },
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

// Keep legacy `advances` in sync with canonical `advanceRecovery` so old
// documents and future Phase 2 logic never diverge into two independent meanings.
(SalarySchema as unknown as { pre: (e: string, fn: (next: (err?: unknown) => void) => void) => void }).pre(
  "validate",
  function (this: unknown, next: (err?: unknown) => void) {
    const doc = this as unknown as Record<string, unknown>;
    const recovery = doc["advanceRecovery"] as number | undefined;
    const legacy = doc["advances"] as number | undefined;
    if (recovery !== undefined && legacy !== recovery) {
      doc["advances"] = recovery;
    } else if (recovery === undefined && legacy !== undefined) {
      doc["advanceRecovery"] = legacy;
    }
    next();
  },
);

export type SalaryDoc = InferSchemaType<typeof SalarySchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Salary =
  (mongoose.models.Salary as mongoose.Model<SalaryDoc> | undefined) ??
  mongoose.model<SalaryDoc>("Salary", SalarySchema);
