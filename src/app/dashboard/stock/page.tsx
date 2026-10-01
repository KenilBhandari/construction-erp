import { LowStockAlerts } from "@/components/inventory/low-stock-alerts";
import { TransactionsList } from "@/components/inventory/transactions-list";

export default function StockPage() {
  return (
    <TransactionsList
      title="Stock Usage"
      types={["consumption", "adjustment", "return"]}
      newLabel="Record Usage"
      headerSuffix={<LowStockAlerts limit={8} />}
    />
  );
}
