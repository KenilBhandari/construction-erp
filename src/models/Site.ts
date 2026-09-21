import mongoose, { Schema, type InferSchemaType } from "mongoose";
import { SITE_STATUSES } from "@/types/site";

const SiteSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    location: { type: String, default: null },
    supervisor: { type: String, default: null },
    startDate: { type: Date, default: null },
    expectedEndDate: { type: Date, default: null },
    status: {
      type: String,
      enum: SITE_STATUSES,
      default: "active",
      index: true,
    },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    notes: { type: String, default: null },
  },
  { timestamps: true },
);

SiteSchema.index({ project: 1, name: 1 });

export type SiteDoc = InferSchemaType<typeof SiteSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Site =
  (mongoose.models.Site as mongoose.Model<SiteDoc> | undefined) ??
  mongoose.model<SiteDoc>("Site", SiteSchema);
