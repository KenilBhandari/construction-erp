import mongoose, { Schema, type InferSchemaType } from "mongoose";

/**
 * Standalone overtime entries (custom rate/amount). OT hours typed during
 * attendance marking live on the Attendance record instead — salary sums
 * both, so enter extra work here only, not twice.
 */
const OvertimeSchema = new Schema(
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
    hours: { type: Number, required: true, min: 0 },
    rate: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    notes: { type: String, default: null },
    idempotencyKey: { type: String },
  },
  { timestamps: true },
);

OvertimeSchema.index({ labour: 1, date: 1 }, { unique: true });
OvertimeSchema.index({ site: 1, date: 1 });
OvertimeSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

export type OvertimeDoc = InferSchemaType<typeof OvertimeSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Overtime =
  (mongoose.models.Overtime as mongoose.Model<OvertimeDoc> | undefined) ??
  mongoose.model<OvertimeDoc>("Overtime", OvertimeSchema);

// Ensure V1 uniqueness: one OT per labour per date. Drop legacy non-unique index if it exists.
Overtime.collection?.dropIndex?.("labour_1_date_1").catch(() => {});
