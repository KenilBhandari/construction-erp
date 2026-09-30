"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { AdvancesTab } from "@/components/salary/advances-tab";
import { CalculatePendingTab } from "@/components/salary/calculate-pending-tab";
import { SalaryRecordsTab } from "@/components/salary/salary-records-tab";
import { cn } from "@/lib/utils";

export type AdvancesCommand = { kind: "add" | "writeoff"; n: number } | null;

export default function SalaryPage() {
  const [tab, setTab] = useState<"calc" | "records" | "advances">("calc");
  const [advCmd, setAdvCmd] = useState<AdvancesCommand>(null);

  function switchTab(next: "calc" | "records" | "advances") {
    // Leaving the tab clears a pending create signal — nothing stale can
    // reopen the modal on return (overtime pattern).
    setAdvCmd(null);
    setTab(next);
  }

  function sendAdvCmd(kind: "add" | "writeoff") {
    setAdvCmd((c) => ({ kind, n: (c?.n ?? 0) + 1 }));
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <PageHeader
        title="Salary"
        action={
          tab === "advances" ? (
            <>
              <Button variant="outline" onClick={() => sendAdvCmd("writeoff")}>
                Write Off
              </Button>
              <Button onClick={() => sendAdvCmd("add")}>Add Advance</Button>
            </>
          ) : undefined
        }
      />
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
            onClick={() => switchTab(t.value)}
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
      {tab === "calc" ? <CalculatePendingTab /> : tab === "records" ? <SalaryRecordsTab /> : <AdvancesTab advCmd={advCmd} />}
    </div>
  );
}
