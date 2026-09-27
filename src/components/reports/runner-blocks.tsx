import Link from "next/link";
import { formatINR } from "@/lib/utils";
import type { CostTrendMonth } from "@/lib/reports";
import { REPORT_PAGE_SIZE } from "@/lib/reports";

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-IN", {
    month: "short",
    timeZone: "UTC",
  });
}

/** Monthly cost trend — stacked labour / materials / expenses bars with legend. */
export function CostTrend({ trend }: { trend: CostTrendMonth[] }) {
  if (trend.length === 0) return <p className="text-sm text-text-muted">No cost in scope.</p>;
  const max = Math.max(1, ...trend.map((m) => m.total));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-28 items-end gap-2">
        {trend.map((m) => (
          <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="flex w-full flex-col justify-end overflow-hidden rounded-sm"
              style={{ height: `${Math.max(4, Math.round((m.total / max) * 96))}px` }}
              title={`${m.month}: labour ${formatINR(m.labour)} · materials ${formatINR(m.materials)} · expenses ${formatINR(m.expenses)}`}
            >
              <div className="w-full bg-primary/25" style={{ height: `${m.total ? (m.expenses / m.total) * 100 : 0}%` }} />
              <div className="w-full bg-primary/50" style={{ height: `${m.total ? (m.materials / m.total) * 100 : 0}%` }} />
              <div className="w-full flex-1 bg-primary" />
            </div>
            <span className="text-[10px] text-text-muted">{monthLabel(m.month)}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 text-xs text-text-muted">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-primary" /> Labour
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-primary/50" /> Materials
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-primary/25" /> Expenses
        </span>
      </div>
    </div>
  );
}

/** Server pagination — 100 rows/page, full history in PDF. */
export function Pager({
  base,
  page,
  total,
}: {
  base: string;
  page: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / REPORT_PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * REPORT_PAGE_SIZE + 1;
  const to = Math.min(page * REPORT_PAGE_SIZE, total);
  const link = (p: number) => `${base}${base.includes("?") ? "&" : "?"}page=${p}`;
  return (
    <div className="no-print flex items-center justify-between gap-2 text-xs text-text-muted">
      <span className="tnum">
        Showing {from}–{to} of {total}
      </span>
      <span className="flex items-center gap-3">
        {page > 1 ? (
          <Link href={link(page - 1)} className="font-medium text-primary hover:underline">
            ← Prev
          </Link>
        ) : (
          <span className="opacity-40">← Prev</span>
        )}
        <span className="tnum">
          {page} / {pages}
        </span>
        {page < pages ? (
          <Link href={link(page + 1)} className="font-medium text-primary hover:underline">
            Next →
          </Link>
        ) : (
          <span className="opacity-40">Next →</span>
        )}
      </span>
    </div>
  );
}
