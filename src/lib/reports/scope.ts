import { Types } from "mongoose";
import { dayRange, formatDateShort } from "@/lib/utils";

/**
 * Report scoping — every time-based report takes a date range, every
 * project-scoped report takes a project, site-attributed reports take a site.
 * Filters are per-report applicable, never forced where meaningless.
 */
export interface ReportScope {
  /** yyyy-mm-dd, inclusive from 00:00:00 UTC. */
  from?: string;
  /** yyyy-mm-dd, inclusive through 23:59:59.999 UTC (dayRange). */
  to?: string;
  /** Project ObjectId string. */
  projectId?: string;
  /** Site ObjectId string — only for site-attributed records. */
  siteId?: string;
}

/**
 * $match fragment on a record `date` field.
 * LOCKED: `to` includes the whole day through 23:59:59.999 — records later on
 * the `to` date are never excluded. Single helper, no per-report bounds.
 */
export function dateMatch(scope?: Pick<ReportScope, "from" | "to">): Record<string, unknown> {
  if (!scope?.from && !scope?.to) return {};
  const { start, end } = dayRange(
    scope.from ?? (scope.to as string),
    scope.to ?? (scope.from as string),
  );
  return { date: { $gte: start, $lte: end } };
}

/** $match fragment for an ObjectId field. Invalid ids are ignored, never throw. */
export function idMatch(field: string, id?: string): Record<string, unknown> {
  if (!id || !Types.ObjectId.isValid(id)) return {};
  return { [field]: new Types.ObjectId(id) };
}

/** Page size for report transaction-history pagination. Single constant, never per-report. */
export const REPORT_PAGE_SIZE = 100;

/** Human-readable active scope, e.g. "Patel Residence · Tower B · 1–27 Sep 2026". */
export function scopeLabel(parts: { project?: string; site?: string; from?: string; to?: string }): string {
  const out: string[] = [];
  if (parts.project) out.push(parts.project);
  if (parts.site) out.push(parts.site);
  if (parts.from || parts.to) {
    const f = parts.from ? formatDateShort(parts.from) : "…";
    const t = parts.to ? formatDateShort(parts.to) : "…";
    out.push(parts.from && parts.to && parts.from === parts.to ? f : `${f} – ${t}`);
  }
  return out.join(" · ");
}
