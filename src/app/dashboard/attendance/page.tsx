"use client";

import { Suspense, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AttendanceMuster } from "@/components/attendance/attendance-muster";
import { OvertimeList } from "@/components/overtime/overtime-list";

function AttendanceContent() {
  const [tab, setTab] = useState<"attendance" | "overtime">("attendance");
  const [otRefreshKey, setOtRefreshKey] = useState(0);
  const [otCreateKey, setOtCreateKey] = useState(0);
  
  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <PageHeader
        title={tab === "attendance" ? "Attendance" : "Overtime"}
        action={
          tab === "overtime" ? (
            <Button onClick={() => setOtCreateKey((k) => k + 1)}>
              Add Overtime
            </Button>
          ) : undefined
        }
      />
      <div className="flex gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setTab("attendance")}
          className={`-mb-px min-h-10 shrink-0 border-b-2 px-3 py-2 text-sm font-medium sm:min-h-0 sm:py-2 ${tab === "attendance" ? "border-primary text-primary" : "border-transparent text-text-muted hover:text-text"}`}
        >
          Attendance
        </button>
        <button
          type="button"
          onClick={() => setTab("overtime")}
          className={`-mb-px min-h-10 shrink-0 border-b-2 px-3 py-2 text-sm font-medium sm:min-h-0 sm:py-2 ${tab === "overtime" ? "border-primary text-primary" : "border-transparent text-text-muted hover:text-text"}`}
        >
          Overtime
        </button>
      </div>
      {tab === "attendance" ? (
        <AttendanceMuster onOtChange={() => setOtRefreshKey((k) => k + 1)} />
      ) : (
        <OvertimeList
          externalRefreshKey={otRefreshKey}
          createRequestKey={otCreateKey}
        />
      )}
    </div>
  );
}

export default function AttendancePage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <AttendanceContent />
    </Suspense>
  );
}
