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

// Hot-reload safety: `next dev` re-evaluates this file but `mongoose.models.Site`
 // may still be the old compiled model (without "inactive"). Patching
 // `enumValues`/`validators` is fragile across Mongoose internals, so
 // delete the stale model and let the export below re-compile with the
 // current SITE_STATUSES including "inactive".
if (mongoose.models.Site) {
  const existingEnum = (mongoose.models.Site.schema.path("status") as any)?.enumValues as
    | string[]
    | undefined;
  if (!existingEnum?.includes("inactive")) {
    delete (mongoose.models as any).Site;
    const connModels = (mongoose.connection as any)?.models as Record<string, unknown> | undefined;
    if (connModels?.Site) delete connModels.Site;
  } else {
    // Even if enum already includes inactive, ensure validator stays in sync
    // (covers the brief window where file re-executes but model wasn't deleted).
    const statusPath = mongoose.models.Site.schema.path("status") as unknown as {
      enumValues: string[];
      options: { enum: readonly string[] };
      validators: Array<{ type?: string; enumValues?: string[] }>;
    };
    if (statusPath) {
      statusPath.enumValues = [...SITE_STATUSES];
      statusPath.options.enum = SITE_STATUSES;
      const enumValidator = statusPath.validators?.find((v) => v.type === "enum");
      if (enumValidator?.enumValues) {
        enumValidator.enumValues = [...SITE_STATUSES];
      }
    }
  }
}

export const Site =
  (mongoose.models.Site as mongoose.Model<SiteDoc> | undefined) ??
  mongoose.model<SiteDoc>("Site", SiteSchema);
