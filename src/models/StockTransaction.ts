import mongoose, { Schema, type InferSchemaType } from "mongoose";

/**
 * Every stock movement. Stock effect:
 * purchase (+) · return (+) — surplus back to stock
 * consumption (−) · adjustment (signed quantity, manual correction)
 * Material.currentStock is updated alongside; consumption that would drive
 * stock negative is rejected. Reversals (edit/delete) must also keep stock
 * non-negative.
 */
const StockTransactionSchema = new Schema(
  {
    material: {
      type: Schema.Types.ObjectId,
      ref: "Material",
      required: true,
      index: true,
    },
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
    type: {
      type: String,
      enum: ["purchase", "consumption", "adjustment", "return"],
      required: true,
      index: true,
    },
    quantity: { type: Number, required: true },
    unit: { type: String, default: null },
    rate: { type: Number, min: 0, default: 0 },
    total: { type: Number, min: 0, default: 0 },
    supplier: { type: String, default: null },
    invoiceNumber: { type: String, default: null },
    purpose: { type: String, default: null },
    notes: { type: String, default: null },
  },
  { timestamps: true },
);

StockTransactionSchema.index({ material: 1, date: -1 });

export type StockTransactionDoc = InferSchemaType<
  typeof StockTransactionSchema
> & {
  _id: mongoose.Types.ObjectId;
};

export const StockTransaction =
  (mongoose.models.StockTransaction as
    | mongoose.Model<StockTransactionDoc>
    | undefined) ??
  mongoose.model<StockTransactionDoc>(
    "StockTransaction",
    StockTransactionSchema,
  );
