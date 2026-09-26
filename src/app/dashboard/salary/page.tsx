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
    <div className="flex flex-col gap-5">
      <PageHeader title="Salary" />
      <div className="flex gap-1 border-b border-border">
        {(
          [
            { value: "calc", label: "Calculate & Pending" },
            { value: "records", label: "Salary Records" },
            { value: "advances", label: "Advances" },
          ] as const
        ).map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors",
              tab === t.value
                ? "border-b-2 border-primary text-primary"
                : "text-text-muted hover:text-text",
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
