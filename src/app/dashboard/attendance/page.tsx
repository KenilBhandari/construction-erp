"use client";

import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { AttendanceMuster } from "@/components/attendance/attendance-muster";

function AttendanceContent() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Attendance"
        description="Daily muster — choose a date, mark workers, filter remaining, bulk-mark, correct."
      />
      <AttendanceMuster />
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
