"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { SalaryTab } from "@/components/salary/salary-tab";
import { AdvancesTab } from "@/components/salary/advances-tab";
import { cn } from "@/lib/utils";

export default function SalaryPage() {
  const [tab, setTab] = useState<"salary" | "advances">("salary");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Salary"
        description="Calculated from attendance — weekly, monthly or any custom period. Advance recovery is explicit per settlement."
      />
      <div className="flex gap-1 border-b border-border">
        {(
          [
            { value: "salary", label: "Salary" },
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
      {tab === "salary" ? <SalaryTab /> : <AdvancesTab />}
    </div>
  );
}
