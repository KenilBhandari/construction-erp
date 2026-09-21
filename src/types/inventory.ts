export const MATERIAL_CATEGORIES = [
  "Cement",
  "Sand",
  "Steel",
  "Bricks",
  "Aggregate",
  "Tiles",
  "Paint",
  "Pipes",
  "Electrical",
  "Wood",
  "Other",
] as const;

export const STOCK_UNITS = [
  "Bag",
  "Kg",
  "Ton",
  "Cubic Feet",
  "Cubic Meter",
  "Piece",
  "Liter",
  "Meter",
] as const;

export const TRANSACTION_TYPES = [
  "purchase",
  "consumption",
  "adjustment",
  "return",
] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export interface MaterialDTO {
  _id: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  defaultPurchaseRate: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export function isLowStock(m: MaterialDTO): boolean {
  return m.currentStock <= m.minimumStock;
}

export interface StockTransactionDTO {
  _id: string;
  material: string | { _id: string; name: string; unit: string };
  project: string | { _id: string; name: string } | null;
  site: string | { _id: string; name: string } | null;
  date: string;
  type: TransactionType;
  quantity: number;
  unit: string;
  rate: number;
  total: number;
  supplier: string | null;
  invoiceNumber: string | null;
  purpose: string | null;
  notes: string | null;
}

export function transactionMaterialName(t: StockTransactionDTO): string {
  return typeof t.material === "string" ? t.material : t.material.name;
}
