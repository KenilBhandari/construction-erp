export const EXPENSE_CATEGORIES = [
  "Labour",
  "Material",
  "Transport",
  "Equipment",
  "Electricity",
  "Water",
  "Contractor",
  "Miscellaneous",
  "Other",
  "LABOUR_ADVANCE_WRITE_OFF",
] as const;

export const EXPENSE_TYPES = ["PROJECT", "GENERAL", "PERSONAL"] as const;

export type ExpenseType = (typeof EXPENSE_TYPES)[number];

export const PAYMENT_METHODS = [
  "Cash",
  "Bank Transfer",
  "UPI",
  "Cheque",
  "Other",
] as const;

export interface ExpenseDTO {
  _id: string;
  project: string | { _id: string; name: string } | null;
  site: string | { _id: string; name: string } | null;
  date: string;
  category: string;
  description: string;
  amount: number;
  vendor: string | null;
  paymentMethod: string;
  reference: string | null;
  notes: string | null;
  expenseType: ExpenseType | null;
  labour: string | { _id: string; name: string } | null;
  labourAdvance: string | null;
}

export interface ClientPaymentDTO {
  _id: string;
  project: string | { _id: string; name: string; clientName: string };
  date: string;
  amount: number;
  paymentMethod: string;
  reference: string | null;
  notes: string | null;
}

/** Derived project finance — every figure labeled estimated in the UI. */
export interface ProjectFinance {
  contractValue: number;
  budget: number;
  materialExpense: number;
  labourExpense: number;
  labourBreakdown: {
    attendanceCost: number;
    overtimeRecords: number;
    presentDays: number;
    halfDays: number;
  };
  manualExpenses: number;
  totalExpense: number;
  received: number;
  pending: number;
  profit: number;
  margin: number;
}
