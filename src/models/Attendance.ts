import mongoose, { Schema, type InferSchemaType } from "mongoose";

/**
 * One record per (labour, site, date) — enforced by unique index (§41).
 * Project is denormalized from the site so project reports stay fast and
 * stable even if the site is later moved between projects.
 */
const AttendanceSchema = new Schema(
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
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    date: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["present", "absent", "half-day", "leave"],
      required: true,
    },
    checkIn: { type: String, default: null },
    checkOut: { type: String, default: null },
    overtimeHours: { type: Number, min: 0, default: 0 },
    notes: { type: String, default: null },
  },
  { timestamps: true },
);

AttendanceSchema.index({ labour: 1, site: 1, date: 1 }, { unique: true });
AttendanceSchema.index({ site: 1, date: 1 });
AttendanceSchema.index({ project: 1, date: 1 });

export type AttendanceDoc = InferSchemaType<typeof AttendanceSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Attendance =
  (mongoose.models.Attendance as mongoose.Model<AttendanceDoc> | undefined) ??
  mongoose.model<AttendanceDoc>("Attendance", AttendanceSchema);
