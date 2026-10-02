"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type DateSortDir = "asc" | "desc";

/**
 * Shared date-sort toggle used by overtime, salary records, advances,
 * stock/purchases, expenses and client payments.
 *
 * - `header` variant lives inside a desktop `<TH>` — inherits muted header
 *   styling, only the icon button affordance is added.
 * - `pill` variant is the phone placement — a compact text + icon toggle,
 *   right-aligned above the cards so card layout stays untouched.
 */
export function DateSortToggle({
  dir,
  onToggle,
  label = "Date",
  variant = "header",
  className,
}: {
  dir: DateSortDir;
  onToggle: () => void;
  label?: string;
  variant?: "header" | "pill";
  className?: string;
}) {
  const Icon = dir === "asc" ? ArrowUp : ArrowDown;
  const next = dir === "asc" ? "newest first" : "oldest first";

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-label={`Sort by ${label.toLowerCase()}, currently ${dir === "asc" ? "oldest first" : "newest first"}. Activate to show ${next}.`}
        aria-pressed={dir === "asc"}
        title={`Sort by ${label.toLowerCase()} (${dir === "asc" ? "oldest first" : "newest first"})`}
        className={cn(
          "inline-flex h-3 items-center gap-1 px-1 font-normal text-text-muted/90 transition-colors hover:text-text active:text-text",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary focus-visible:rounded-sm",
          className,
        )}
      >
        {/* Inline size so the phone caption is visibly smaller no matter what. */}
        <span style={{ fontSize: 12, lineHeight: 1.2, letterSpacing: "0.02em" }}>
          {label}
        </span>
        <Icon aria-hidden="true" className="h-3.5 w-3.5 opacity-60" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Sort by ${label.toLowerCase()}, currently ${dir === "asc" ? "oldest first" : "newest first"}. Activate to show ${next}.`}
      aria-pressed={dir === "asc"}
      title={`Sort by ${label.toLowerCase()} (${dir === "asc" ? "oldest first" : "newest first"})`}
      className={cn(
        "inline-flex items-center gap-1 transition-colors hover:text-text",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary focus-visible:rounded-sm",
        className,
      )}
    >
      {label}
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
    </button>
  );
}

/** `?sort=` value for plain `date`-field collections. */
export function dateSortParam(dir: DateSortDir): string {
  return dir === "asc" ? "date-asc" : "date-desc";
}

/** `?sort=` value for salary settlements (sorted by period start). */
export function salarySortParam(dir: DateSortDir): string {
  return dir === "asc" ? "start-asc" : "start-desc";
}
