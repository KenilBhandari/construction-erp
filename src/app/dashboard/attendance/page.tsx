"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { MarkAttendance } from "@/components/attendance/mark-attendance";
import { AttendanceRecords } from "@/components/attendance/attendance-records";
import { cn } from "@/lib/utils";

function AttendanceContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "records" ? "records" : "mark";
  const initialLabour = searchParams.get("labour") ?? "";
  const [tab, setTab] = useState<"mark" | "records">(initialTab);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Attendance"
        description="Mark today's site attendance in seconds, review history by date, site or worker."
      />
      <div className="flex gap-1 border-b border-border">
        {(
          [
            { value: "mark", label: "Mark Attendance" },
            { value: "records", label: "Records" },
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
      {tab === "mark" ? (
        <MarkAttendance />
      ) : (
        <AttendanceRecords initialLabourId={initialLabour} />
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
