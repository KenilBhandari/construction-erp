"use client";

import { Suspense, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { AttendanceMuster } from "@/components/attendance/attendance-muster";
import { OvertimeList } from "@/components/overtime/overtime-list";

function AttendanceContent() {
  const [tab, setTab] = useState<"attendance" | "overtime">("attendance");
  const [otRefreshKey, setOtRefreshKey] = useState(0);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Attendance"
        description="Daily muster — choose a date, mark workers, filter remaining, bulk-mark, correct. Overtime is per-day (one per worker) and lives here."
      />
      <div className="flex gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setTab("attendance")}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === "attendance" ? "border-primary text-primary" : "border-transparent text-text-muted hover:text-text"}`}
        >
          Attendance
        </button>
        <button
          type="button"
          onClick={() => setTab("overtime")}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === "overtime" ? "border-primary text-primary" : "border-transparent text-text-muted hover:text-text"}`}
        >
          Overtime
        </button>
      </div>
      {tab === "attendance" ? (
        <AttendanceMuster onOtChange={() => setOtRefreshKey((k) => k + 1)} />
      ) : (
        <OvertimeList externalRefreshKey={otRefreshKey} />
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
