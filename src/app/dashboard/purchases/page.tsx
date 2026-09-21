import { TransactionsList } from "@/components/inventory/transactions-list";

export default function PurchasesPage() {
  return (
    <TransactionsList
      title="Purchases"
      description="Material bought from suppliers. Quantity × rate adds to project material cost."
      types={["purchase"]}
      newLabel="Record Purchase"
    />
  );
}
