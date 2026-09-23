import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes: cn("px-2", active && "bg-primary") */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format paise/rupees as Indian currency: 2500000 -> ₹25,00,000 */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format a Date as "18 Sep 2026" */
export function formatDateShort(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** "2026-09-18" for <input type="date"> defaults (attendance defaults to today). */
export function toDateInputValue(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Normalize a yyyy-mm-dd (or Date) to UTC midnight for storage.
 * Write and read paths must both use this so same-day records match.
 */
export function toDayDate(input: string | Date): Date {
  const d =
    typeof input === "string"
      ? new Date(input.length <= 10 ? `${input}T00:00:00Z` : input)
      : input;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Inclusive [start, end] range covering whole days, for record filters. */
export function dayRange(from: string, to: string): { start: Date; end: Date } {
  const start = toDayDate(from);
  const end = toDayDate(to);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

/** Attendance cost: present=1, half-day=0.5, absent/leave=0 */
export function attendanceCostFor(status: string, dailyRate: number): number {
  if (status === "present") return Math.round(dailyRate);
  if (status === "half-day") return Math.round(dailyRate * 0.5);
  return 0;
}

export function getIdempotencyKey(req: Request): string | null {
  const h = req.headers.get("x-idempotency-key") ?? req.headers.get("X-Idempotency-Key");
  if (!h) return null;
  const v = h.trim();
  return v.length > 0 ? v.slice(0, 128) : null;
}

export function perRecordIdempotencyKey(baseKey: string, labourId: string, dateStr: string): string {
  return `${baseKey}:${labourId}:${dateStr}`;
}
