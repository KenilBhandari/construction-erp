import mongoose, { Schema, type InferSchemaType } from "mongoose";

const SalaryPaymentSchema = new Schema(
  {
    salarySettlementId: {
      type: Schema.Types.ObjectId,
      ref: "Salary",
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 1 },
    date: { type: Date, required: true, index: true },
    paymentMethod: { type: String, default: "Cash" },
    reference: { type: String, default: null },
    notes: { type: String, default: null },
  },
  { timestamps: true },
);

SalaryPaymentSchema.index({ salarySettlementId: 1, date: 1 });
SalaryPaymentSchema.index({ salarySettlementId: 1, createdAt: 1 });

export type SalaryPaymentDoc = InferSchemaType<typeof SalaryPaymentSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const SalaryPayment =
  (mongoose.models.SalaryPayment as mongoose.Model<SalaryPaymentDoc> | undefined) ??
  mongoose.model<SalaryPaymentDoc>("SalaryPayment", SalaryPaymentSchema);
