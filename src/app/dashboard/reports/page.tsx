import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ReportCard {
  href?: string;
  group: string;
  title: string;
  description: string;
}

const CARDS: ReportCard[] = [
  {
    href: "/dashboard/reports/labour",
    group: "Labour",
    title: "Labour & Attendance",
    description: "Attendance, labour cost and overtime history per worker.",
  },
  {
    href: "/dashboard/reports/salary",
    group: "Labour",
    title: "Salary & Advances",
    description: "Earnings, payments, balances and advances.",
  },
  {
    href: "/dashboard/reports/materials",
    group: "Inventory",
    title: "Materials & Stock",
    description: "Purchases, consumption, returns and stock history.",
  },
  {
    href: "/dashboard/reports/expenses",
    group: "Finance",
    title: "Expenses",
    description: "Expense history and breakdowns.",
  },
];

/** Reports landing — pick what to investigate, then scope and run. */
export default function ReportsLanding() {
  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
      <PageHeader title="Reports" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
        {CARDS.map((c) => {
          const body = (
            <Card className="flex h-full flex-col gap-1 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-text-muted">{c.group}</p>
                {!c.href && <Badge tone="neutral">Soon</Badge>}
              </div>
              <p className="text-base font-semibold text-text">{c.title}</p>
              <p className="text-xs text-text-muted">{c.description}</p>
            </Card>
          );
          return c.href ? (
            <Link key={c.title} href={c.href} className="hover:opacity-90">
              {body}
            </Link>
          ) : (
            <div key={c.title} className="cursor-not-allowed opacity-70">
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
