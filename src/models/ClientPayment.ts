import mongoose, { Schema, type InferSchemaType } from "mongoose";

/**
 * Money received from the client. Client identity derives from the
 * project (Project.clientName) — no duplicate client field.
 */
const ClientPaymentSchema = new Schema(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    date: { type: Date, required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    paymentMethod: { type: String, default: "Cash" },
    reference: { type: String, default: null },
    notes: { type: String, default: null },
  },
  { timestamps: true },
);

ClientPaymentSchema.index({ project: 1, date: -1 });

export type ClientPaymentDoc = InferSchemaType<
  typeof ClientPaymentSchema
> & {
  _id: mongoose.Types.ObjectId;
};

export const ClientPayment =
  (mongoose.models.ClientPayment as
    | mongoose.Model<ClientPaymentDoc>
    | undefined) ??
  mongoose.model<ClientPaymentDoc>("ClientPayment", ClientPaymentSchema);
