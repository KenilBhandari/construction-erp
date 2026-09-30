"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { AdvancesTab } from "@/components/salary/advances-tab";
import { CalculatePendingTab } from "@/components/salary/calculate-pending-tab";
import { SalaryRecordsTab } from "@/components/salary/salary-records-tab";
import { cn } from "@/lib/utils";

export default function SalaryPage() {
  const [tab, setTab] = useState<"calc" | "records" | "advances">("calc");

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <PageHeader title="Salary" />
      <div className="flex gap-2 border-b border-border">
        {(
          [
            { value: "calc", label: "Pending" },
            { value: "records", label: "Records" },
            { value: "advances", label: "Advances" },
          ] as const
        ).map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              "-mb-px min-h-10 shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors sm:min-h-0 sm:py-2",
              tab === t.value
                ? "border-primary text-primary"
                : "border-transparent text-text-muted hover:text-text",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "calc" ? <CalculatePendingTab /> : tab === "records" ? <SalaryRecordsTab /> : <AdvancesTab />}
    </div>
  );
}
