import mongoose, { Schema, type InferSchemaType } from "mongoose";

/**
 * Site assignment history. `to: null` means the current (open) assignment.
 * Historical attendance references sites directly, so reassigning never
 * breaks past records (§14).
 */
const LabourAssignmentSchema = new Schema(
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
      required: true,
      index: true,
    },
    from: { type: Date, required: true, default: () => new Date() },
    to: { type: Date, default: null },
    notes: { type: String, default: null },
  },
  { timestamps: true },
);

LabourAssignmentSchema.index({ labour: 1, from: -1 });

export type LabourAssignmentDoc = InferSchemaType<
  typeof LabourAssignmentSchema
> & {
  _id: mongoose.Types.ObjectId;
};

export const LabourAssignment =
  (mongoose.models.LabourAssignment as
    | mongoose.Model<LabourAssignmentDoc>
    | undefined) ??
  mongoose.model<LabourAssignmentDoc>(
    "LabourAssignment",
    LabourAssignmentSchema,
  );
