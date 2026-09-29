"use client";

import { formatDateCompact, formatDateShort } from "@/lib/utils";

/**
 * Compact date on phone ("18/09/26"), full date on desktop
 * ("18 Sep 2026"). Desktop rendering unchanged.
 */
export function ResponsiveDate({ date }: { date: Date | string }) {
  return (
    <>
      <span className="sm:hidden">{formatDateCompact(date)}</span>
      <span className="hidden sm:inline">{formatDateShort(date)}</span>
    </>
  );
}
