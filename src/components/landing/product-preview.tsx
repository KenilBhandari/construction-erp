import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";

/**
 * Faithful, static preview built from the real design-system primitives
 * (Card / Badge / ProgressBar). Representative demo values only —
 * clearly labelled illustrative, no fake customers or claims.
 */

const STATS = [
  { label: "Active Projects", value: "4", hint: "7 active sites" },
  { label: "Today's Labour", value: "42 / 51", hint: "present / active" },
  { label: "Client Payments", value: "₹2.10L", hint: "pending · ₹18.00L received" },
  { label: "Est. Project Margin", value: "₹3.45L", hint: "contract − recorded costs" },
];

const PROJECTS = [
  { name: "Patel Residence", meta: "Ahmedabad", status: "Active", tone: "success" as const, progress: 65, money: "₹16.80L / ₹25.00L" },
  { name: "Sharma Commercial", meta: "Gandhinagar", status: "Active", tone: "success" as const, progress: 38, money: "₹9.20L / ₹32.00L" },
  { name: "Boundary Wall — Plot 7", meta: "Sanand", status: "On Hold", tone: "warning" as const, progress: 82, money: "₹4.10L / ₹6.50L" },
];

const MUSTER = [
  { name: "Ramesh", skill: "Mason · ₹900/d", state: "Present" },
  { name: "Suresh", skill: "Helper · ₹600/d", state: "Present" },
  { name: "Mahesh", skill: "Carpenter · ₹850/d", state: "Half" },
  { name: "Raj", skill: "Helper · ₹600/d", state: "Absent" },
];

function musterTone(state: string) {
  if (state === "Present") return "bg-primary text-white border-transparent";
  if (state === "Half") return "bg-amber-50 text-warning border-transparent";
  return "bg-background text-text-muted border-border";
}

export function ProductPreview() {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STATS.map((s) => (
          <Card key={s.label} className="min-w-0 p-3 sm:p-4">
            <p className="truncate text-xs text-text-muted sm:text-[13px]">{s.label}</p>
            <p className="mt-1 truncate text-lg font-semibold tnum tracking-tight text-text sm:text-2xl">
              {s.value}
            </p>
            <p className="mt-0.5 hidden truncate text-xs text-text-muted sm:block">{s.hint}</p>
          </Card>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-5">
        {/* Project overview — mirrors /dashboard Project Overview card */}
        <Card className="p-4 sm:p-5 lg:col-span-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="min-w-0 truncate text-[15px] font-semibold text-text">Project Overview</h3>
            <Badge tone="neutral">Budget vs actual</Badge>
          </div>
          <ul className="mt-2 divide-y divide-border">
            {PROJECTS.map((p) => (
              <li key={p.name} className="py-3 first:pt-2 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text sm:text-[15px]">{p.name}</p>
                    <p className="truncate text-xs text-text-muted">{p.meta}</p>
                  </div>
                  <Badge tone={p.tone}>{p.status}</Badge>
                </div>
                <div className="mt-2 flex items-center gap-2.5">
                  <ProgressBar value={p.progress} className="min-w-0 flex-1" />
                  <span className="shrink-0 whitespace-nowrap text-xs tnum text-text-muted">{p.money}</span>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
            <span className="text-text-muted">Received vs pending</span>
            <span className="font-medium tnum text-text">86% received</span>
          </div>
          <ProgressBar value={86} className="mt-2" />
        </Card>

        <div className="flex flex-col gap-3 lg:col-span-2">
          {/* Fast attendance — mirrors /dashboard/attendance muster */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-[15px] font-semibold text-text">Main Building — Today</h3>
                <p className="truncate text-xs text-text-muted">Site-wise muster</p>
              </div>
              <Badge tone="primary">12 assigned</Badge>
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {MUSTER.map((w) => (
                <li
                  key={w.name}
                  className="flex items-center justify-between gap-2 border-b border-border pb-2 text-sm last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-text">{w.name}</p>
                    <p className="truncate text-xs text-text-muted">{w.skill}</p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${musterTone(w.state)}`}
                  >
                    {w.state}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-col gap-2 min-[420px]:flex-row">
              <span className="inline-flex flex-1 items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-white">
                Save attendance
              </span>
              <span className="inline-flex items-center justify-center rounded-md border border-border px-3 py-2 text-sm font-medium text-text">
                All present
              </span>
            </div>
          </Card>

          {/* Low stock — mirrors dashboard Low Stock card */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-semibold text-text">Low Stock</h3>
              <Badge tone="warning">3 items</Badge>
            </div>
            <ul className="mt-2 divide-y divide-border text-sm">
              <li className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate font-medium text-text">Cement</span>
                <span className="shrink-0 whitespace-nowrap text-[13px] tnum text-text-muted">18 / min 50 bags</span>
              </li>
              <li className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate font-medium text-text">Steel</span>
                <span className="shrink-0 whitespace-nowrap text-[13px] tnum text-text-muted">120 / min 500 kg</span>
              </li>
              <li className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate font-medium text-text">Paint</span>
                <span className="shrink-0 whitespace-nowrap text-[13px] tnum text-text-muted">12 / min 20 litres</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
