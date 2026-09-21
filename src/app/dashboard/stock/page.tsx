import { LowStockAlerts } from "@/components/inventory/low-stock-alerts";
import { TransactionsList } from "@/components/inventory/transactions-list";

export default function StockPage() {
  return (
    <div className="flex flex-col gap-6">
      <LowStockAlerts limit={8} />
      <TransactionsList
        title="Stock Usage"
        description="Daily consumption, site returns and manual corrections. Consumption can't exceed available stock."
        types={["consumption", "adjustment", "return"]}
        newLabel="Record Entry"
      />
    </div>
  );
}
