import { LowStockAlerts } from "@/components/inventory/low-stock-alerts";
import { TransactionsList } from "@/components/inventory/transactions-list";

export default function StockPage() {
  return (
    <TransactionsList
      title="Stock Usage"
      description="Daily consumption, site returns and manual corrections. Consumption can't exceed available stock."
      types={["consumption", "adjustment", "return"]}
      newLabel="Record Usage"
      headerSuffix={<LowStockAlerts limit={8} />}
    />
  );
}
