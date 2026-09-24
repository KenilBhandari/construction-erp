import mongoose, { Schema, type InferSchemaType } from "mongoose";

/**
 * Money actually given to labour (recoverable outstanding, not expense).
 * site/project are attribution only (§5) — outstanding belongs to labour.
 */
const LabourAdvanceSchema = new Schema(
  {
    labour: {
      type: Schema.Types.ObjectId,
      ref: "Labour",
      required: true,
      index: true,
    },
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
    date: { type: Date, required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    reason: { type: String, default: null },
    paymentMethod: { type: String, default: null },
    reference: { type: String, default: null },
    notes: { type: String, default: null },
    idempotencyKey: { type: String, select: false },
  },
  { timestamps: true },
);

LabourAdvanceSchema.index({ labour: 1, date: 1 });
LabourAdvanceSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

export type LabourAdvanceDoc = InferSchemaType<typeof LabourAdvanceSchema> & {
  _id: mongoose.Types.ObjectId;
};

// Hot-reload safety: project/paymentMethod/reference added in Phase 2/3.
// If dev server still holds old compiled model without those paths, force recompile.
const _existingAdvance = mongoose.models.LabourAdvance as
  | mongoose.Model<LabourAdvanceDoc>
  | undefined;
if (_existingAdvance) {
  const hasProject = !!(_existingAdvance.schema.path("project") as unknown);
  const hasPayment = !!(_existingAdvance.schema.path("paymentMethod") as unknown);
  if (!hasProject || !hasPayment) {
    delete (mongoose.models as Record<string, unknown>).LabourAdvance;
  }
}

export const LabourAdvance =
  (mongoose.models.LabourAdvance as
    | mongoose.Model<LabourAdvanceDoc>
    | undefined) ??
  mongoose.model<LabourAdvanceDoc>("LabourAdvance", LabourAdvanceSchema);
