import mongoose, { Schema, type InferSchemaType } from "mongoose";

/**
 * V1 muster: one record per labour+date (unique). Site is optional and
 * historical — attendance.site is where the labour was recorded that day,
 * independent of LabourAssignment (current assignment). Project is denormalized
 * from site when site is present, otherwise null.
 */
const AttendanceSchema = new Schema(
  {
    labour: {
      type: Schema.Types.ObjectId,
      ref: "Labour",
      required: true,
      index: true,
    },
    date: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["present", "half-day", "absent"],
      required: true,
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
    notes: { type: String, default: null },
    // Kept for salary compatibility (attendance OT hours). Not exposed in V1 UI.
    overtimeHours: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true },
);

// One record per labour per calendar date — DB-level duplicate protection.
AttendanceSchema.index({ labour: 1, date: 1 }, { unique: true });
AttendanceSchema.index({ date: 1 });
AttendanceSchema.index({ site: 1, date: 1 });
AttendanceSchema.index({ project: 1, date: 1 });

export type AttendanceDoc = InferSchemaType<typeof AttendanceSchema> & {
  _id: mongoose.Types.ObjectId;
};

// Hot-reload safety: old schema had site required + leave + labour+site+date unique.
// If dev server holds old compiled model, force recompile.
const _existingAtt = mongoose.models.Attendance as
  | mongoose.Model<AttendanceDoc>
  | undefined;
if (_existingAtt) {
  const statusPath = _existingAtt.schema.path("status") as unknown as { enumValues?: string[] } | undefined;
  const sitePath = _existingAtt.schema.path("site") as unknown as { options?: { required?: boolean } } | undefined;
  const hasLeave = !!statusPath?.enumValues?.includes("leave");
  const siteRequired = !!(sitePath?.options?.required as boolean | undefined);
  const hasCheckIn = !!_existingAtt.schema.path("checkIn");
  if (hasLeave || siteRequired || hasCheckIn) {
    delete (mongoose.models as Record<string, unknown>).Attendance;
  }
}

export const Attendance =
  (mongoose.models.Attendance as mongoose.Model<AttendanceDoc> | undefined) ??
  mongoose.model<AttendanceDoc>("Attendance", AttendanceSchema);

// Best-effort: drop legacy unique index labour+site+date if it still exists (now labour+date).
Attendance.collection?.dropIndex?.("labour_1_site_1_date_1").catch(() => {});
