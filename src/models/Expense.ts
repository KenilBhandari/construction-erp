import mongoose, { Schema, type InferSchemaType } from "mongoose";

/**
 * Manual project costs (transport, equipment, contractor…).
 * Salary and stock purchases count toward project expense automatically —
 * don't re-enter them here (the form says so too).
 *
 * Write-offs (§9-11) are stored as expenses with category
 * LABOUR_ADVANCE_WRITE_OFF + expenseType for project/general/personal
 * attribution and traceability via labour/labourAdvance.
 */
const ExpenseSchema = new Schema(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      default: null,
      index: true,
    },
    site: {
      type: Schema.Types.ObjectId,
      ref: "Site",
      default: null,
      index: true,
    },
    date: { type: Date, required: true, index: true },
    category: { type: String, required: true, trim: true, index: true },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 1 },
    vendor: { type: String, default: null },
    paymentMethod: { type: String, default: "Cash" },
    reference: { type: String, default: null },
    notes: { type: String, default: null },
    // §16/§10 — classification for project vs general/personal costs
    expenseType: {
      type: String,
      enum: ["PROJECT", "GENERAL", "PERSONAL"],
      default: null,
      index: true,
    },
    // Traceability for write-offs (§11)
    labour: {
      type: Schema.Types.ObjectId,
      ref: "Labour",
      default: null,
      index: true,
    },
    labourAdvance: {
      type: Schema.Types.ObjectId,
      ref: "LabourAdvance",
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

ExpenseSchema.index({ project: 1, date: -1 });

export type ExpenseDoc = InferSchemaType<typeof ExpenseSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Expense =
  (mongoose.models.Expense as mongoose.Model<ExpenseDoc> | undefined) ??
  mongoose.model<ExpenseDoc>("Expense", ExpenseSchema);
