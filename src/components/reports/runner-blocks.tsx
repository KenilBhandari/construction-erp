
import Link from "next/link";
import { cn } from "@/lib/utils";
import { REPORT_PAGE_SIZE } from "@/lib/reports";

/** Button look shared with the outline/sm Button — pager navigates via links. */
const pagerBtn =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary border border-border bg-surface text-text hover:bg-background px-3 py-1.5 text-sm";

/** Server pagination — same language as every module list: count · page of pages + Previous/Next. */
export function Pager({
  base,
  page,
  total,
  unit = "entries",
}: {
  base: string;
  page: number;
  total: number;
  unit?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / REPORT_PAGE_SIZE));
  const link = (p: number) => `${base}${base.includes("?") ? "&" : "?"}page=${p}`;
  return (
    <div className="no-print flex items-center justify-between text-sm text-text-muted">
      <p className="tnum">
        {total} {unit} · Page {page} of {pages}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={link(page - 1)} className={cn(pagerBtn)} aria-label="Previous page">
            Previous
          </Link>
        ) : (
          <span className={cn(pagerBtn, "pointer-events-none opacity-60")} aria-disabled="true">
            Previous
          </span>
        )}
        {page < pages ? (
          <Link href={link(page + 1)} className={cn(pagerBtn)} aria-label="Next page">
            Next
          </Link>
        ) : (
          <span className={cn(pagerBtn, "pointer-events-none opacity-60")} aria-disabled="true">
            Next
          </span>
        )}
      </div>
    </div>
  );
}
