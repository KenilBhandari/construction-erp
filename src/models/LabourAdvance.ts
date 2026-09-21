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
  },
  { timestamps: true },
);

LabourAdvanceSchema.index({ labour: 1, date: 1 });

export type LabourAdvanceDoc = InferSchemaType<typeof LabourAdvanceSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const LabourAdvance =
  (mongoose.models.LabourAdvance as
    | mongoose.Model<LabourAdvanceDoc>
    | undefined) ??
  mongoose.model<LabourAdvanceDoc>("LabourAdvance", LabourAdvanceSchema);
