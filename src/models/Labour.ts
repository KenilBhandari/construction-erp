import mongoose, { Schema, type InferSchemaType } from "mongoose";

const LabourSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    photo: { type: String, default: null },
    // Free text (not enum) so custom skill types work in the future (§10).
    skill: { type: String, required: true, trim: true, index: true },
    dailyRate: { type: Number, required: true, min: 0, default: 0 },
    hourlyRate: { type: Number, required: true, min: 0, default: 0 },
    joiningDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
    assignedSite: {
      type: Schema.Types.ObjectId,
      ref: "Site",
      default: null,
      index: true,
    },
    notes: { type: String, default: null },
  },
  { timestamps: true },
);

LabourSchema.index({ name: 1 });
LabourSchema.index({ phone: 1 });

export type LabourDoc = InferSchemaType<typeof LabourSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Labour =
  (mongoose.models.Labour as mongoose.Model<LabourDoc> | undefined) ??
  mongoose.model<LabourDoc>("Labour", LabourSchema);
