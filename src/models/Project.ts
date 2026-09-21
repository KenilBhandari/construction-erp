import mongoose, { Schema, type InferSchemaType } from "mongoose";
import { PROJECT_STATUSES } from "@/types/project";

const ProjectSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    clientName: { type: String, required: true, trim: true },
    clientPhone: { type: String, default: null },
    location: { type: String, required: true, trim: true },
    startDate: { type: Date, default: null },
    expectedEndDate: { type: Date, default: null },
    budget: { type: Number, required: true, min: 0, default: 0 },
    contractValue: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      enum: PROJECT_STATUSES,
      default: "active",
      index: true,
    },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    description: { type: String, default: null },
  },
  { timestamps: true },
);

ProjectSchema.index({ name: 1 });

export type ProjectDoc = InferSchemaType<typeof ProjectSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Project =
  (mongoose.models.Project as mongoose.Model<ProjectDoc> | undefined) ??
  mongoose.model<ProjectDoc>("Project", ProjectSchema);
