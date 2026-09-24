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
    idempotencyKey: { type: String, select: false },
  },
  { timestamps: true },
);

SalaryPaymentSchema.index({ salarySettlementId: 1, date: 1 });
SalaryPaymentSchema.index({ salarySettlementId: 1, createdAt: 1 });
SalaryPaymentSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
SalaryPaymentSchema.index({ salarySettlementId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });

export type SalaryPaymentDoc = InferSchemaType<typeof SalaryPaymentSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const SalaryPayment =
  (mongoose.models.SalaryPayment as mongoose.Model<SalaryPaymentDoc> | undefined) ??
  mongoose.model<SalaryPaymentDoc>("SalaryPayment", SalaryPaymentSchema);
