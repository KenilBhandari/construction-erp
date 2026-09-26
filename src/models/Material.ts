import mongoose, { Schema, type InferSchemaType } from "mongoose";

const MaterialSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    // Free text with UI suggestions so new categories work (§22).
    category: { type: String, required: true, trim: true, index: true },
    unit: { type: String, default: null, trim: true },
    // Maintained by stock transactions — never edited directly.
    currentStock: { type: Number, required: true, default: 0 },
    minimumStock: { type: Number, required: true, min: 0, default: 0 },
    defaultPurchaseRate: { type: Number, required: true, min: 0, default: 0 },
    notes: { type: String, default: null },
  },
  { timestamps: true },
);

MaterialSchema.index({ name: 1 });

export type MaterialDoc = InferSchemaType<typeof MaterialSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Material =
  (mongoose.models.Material as mongoose.Model<MaterialDoc> | undefined) ??
  mongoose.model<MaterialDoc>("Material", MaterialSchema);
