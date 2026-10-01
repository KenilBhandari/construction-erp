"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { ComboSelect } from "@/components/ui/combo-select";

export type RunnerType = "labour" | "materials" | "expenses" | "salary";

// Project/site scoping lives only on materials + expenses. Labour and salary
// reports scope by worker + period.
const PROJECT_SCOPED: RunnerType[] = ["materials", "expenses"];

export interface ScopeOption {
  _id: string;
  name: string;
  projectId?: string;
  startDate?: string | null;
}

type Preset =
  | "today"
  | "week"
  | "month"
  | "last-month"
  | "year"
  | "last-12"
  | "lifetime"
  | "custom";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "last-month", label: "Last Month" },
  { value: "year", label: "This Year" },
  { value: "last-12", label: "Last 12 Months" },
  { value: "lifetime", label: "Project Lifetime" },
  { value: "custom", label: "Custom" },
];

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Preset → [from, to] in UTC days. Lifetime resolves from the project start date. */
function presetRange(preset: Preset, projectStart?: string | null): [string, string] | [] {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const yearStart = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  switch (preset) {
    case "today":
      return [iso(today), iso(today)];
    case "week":
      return [iso(monday), iso(today)];
    case "month":
      return [iso(monthStart), iso(today)];
    case "last-month": {
      const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
      const last = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
      return [iso(first), iso(last)];
    }
    case "year":
      return [iso(yearStart), iso(today)];
    case "last-12": {
      const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 11, 1));
      return [iso(from), iso(today)];
    }
    case "lifetime":
      return projectStart ? [projectStart.slice(0, 10), iso(today)] : [];
    case "custom":
      return [];
  }
}

/**
 * Scope form per runner type — entity selects + period presets + custom dates.
 * Controls match the module filter bars: label-less ComboSelects (h-9/sm:h-10)
 * and compact date inputs. Run navigates to the same URL with scope params
 * (shareable report links).
 */
export function ReportScopeForm({
  type,
  projects,
  sites,
  workers,
  materials,
  categories,
  initial,
}: {
  type: RunnerType;
  projects: ScopeOption[];
  sites: ScopeOption[];
  workers: ScopeOption[];
  materials: ScopeOption[];
  categories: string[];
  initial: {
    projectId: string;
    siteId: string;
    labourId: string;
    materialId: string;
    category: string;
    from: string;
    to: string;
    preset: string;
  };
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(initial.projectId);
  const [siteId, setSiteId] = useState(initial.siteId);
  const [labourId, setLabourId] = useState(initial.labourId);
  const [materialId, setMaterialId] = useState(initial.materialId);
  const [category, setCategory] = useState(initial.category);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  // Materials has no period presets — just a From/To range.
  const [preset, setPreset] = useState<Preset>(
    type === "materials" ? "custom" : ((initial.preset as Preset) || "custom"),
  );
  const [projectSites, setProjectSites] = useState<ScopeOption[]>([]);

  function loadSites(pid: string) {
    if (!pid) {
      setProjectSites([]);
      return;
    }
    const local = sites.filter((s) => s.projectId === pid);
    if (local.length > 0) {
      setProjectSites(local);
      return;
    }
    fetch(`/api/sites?project=${pid}&limit=100`)
      .then(async (r) => r.json())
      .then((j) => {
        if (Array.isArray(j.data)) setProjectSites(j.data);
      })
      .catch(() => {});
  }

  function run() {
    const params = new URLSearchParams();
    const scoped = PROJECT_SCOPED.includes(type);
    if (scoped && projectId) params.set("project", projectId);
    if (scoped && siteId) params.set("site", siteId);
    if ((type === "labour" || type === "salary") && labourId) params.set("worker", labourId);
    if (type === "materials" && materialId) params.set("material", materialId);
    if (type === "expenses" && category) params.set("category", category);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    router.push(`/dashboard/reports/${type}${qs ? `?${qs}` : ""}`);
  }

  function applyPreset(p: Preset, pid: string) {
    setPreset(p);
    if (p === "custom") return;
    const projectStart = projects.find((x) => x._id === pid)?.startDate;
    const [f, t] = presetRange(p, projectStart);
    setFrom(f ?? "");
    setTo(t ?? "");
  }

  function onProjectChange(pid: string) {
    setProjectId(pid);
    setSiteId("");
    loadSites(pid);
    if (preset !== "custom") {
      const projectStart = projects.find((x) => x._id === pid)?.startDate;
      const [f, t] = presetRange(preset, projectStart);
      setFrom(f ?? "");
      setTo(t ?? "");
    }
  }

  const scoped = PROJECT_SCOPED.includes(type);
  const siteOptions = projectId ? projectSites : sites;
  // ComboSelect options carry no per-option disabled state — hide the
  // lifetime preset until a project is picked instead of disabling it.
  const presetOptions = PRESETS.filter(
    (p) => p.value !== "lifetime" || !scoped || projectId,
  ).map((p) => ({ value: p.value, label: p.label }));

  const projectNode = (
    <ComboSelect
      ariaLabel="Filter by project"
      value={projectId}
      options={[
        { value: "", label: "All projects" },
        ...projects.map((p) => ({ value: p._id, label: p.name })),
      ]}
      onChange={onProjectChange}
    />
  );
  const siteNode = (
    <ComboSelect
      ariaLabel="Filter by site"
      value={siteId}
      options={[
        { value: "", label: "All sites" },
        ...siteOptions.map((s) => ({ value: s._id, label: s.name })),
      ]}
      onChange={setSiteId}
    />
  );
  const workerNode = (
    <ComboSelect
      ariaLabel="Filter by worker"
      value={labourId}
      options={[
        { value: "", label: type === "labour" ? "Select worker" : "All workers" },
        ...workers.map((w) => ({ value: w._id, label: w.name })),
      ]}
      onChange={setLabourId}
    />
  );
  const materialNode = (
    <ComboSelect
      ariaLabel="Filter by material"
      value={materialId}
      options={[
        { value: "", label: "Select material" },
        ...materials.map((m) => ({ value: m._id, label: m.name })),
      ]}
      onChange={setMaterialId}
    />
  );
  const categoryNode = (
    <ComboSelect
      ariaLabel="Filter by category"
      value={category}
      options={[
        { value: "", label: "All categories" },
        ...categories.map((c) => ({ value: c, label: c })),
      ]}
      onChange={setCategory}
    />
  );
  const periodNode = (
    <ComboSelect
      ariaLabel="Filter by period"
      value={preset}
      options={presetOptions}
      onChange={(v) => applyPreset(v as Preset, projectId)}
    />
  );
  const fromNode = (
    <DateField
      aria-label="From date"
      variant="button"
      value={from}
      onChange={setFrom}
    />
  );
  const toNode = (
    <DateField
      aria-label="To date"
      variant="button"
      value={to}
      onChange={setTo}
      minDate={from || undefined}
    />
  );

  return (
    <div className="flex min-w-0 flex-col gap-2 sm:gap-3">
      {/* Phone: paired rows, matching the module filter bars. */}
      <div className="flex flex-col gap-2 sm:hidden">
        {scoped && (
          <div className="flex flex-row gap-2">
            <div className="min-w-0 flex-1">{projectNode}</div>
            <div className="min-w-0 flex-1">{siteNode}</div>
          </div>
        )}
        {(type === "labour" || type === "salary") && (
          <div className="flex flex-row gap-2">
            <div className="min-w-0 flex-1">{workerNode}</div>
            <div className="min-w-0 flex-1">{periodNode}</div>
          </div>
        )}
        {type === "materials" && (
          <div className="min-w-0">{materialNode}</div>
        )}
        {type === "expenses" && (
          <div className="flex flex-row gap-2">
            <div className="min-w-0 flex-1">{categoryNode}</div>
            <div className="min-w-0 flex-1">{periodNode}</div>
          </div>
        )}
        {preset === "custom" && (
          <div className="flex flex-row gap-2">
            <div className="min-w-0 flex-1">{fromNode}</div>
            <div className="min-w-0 flex-1">{toNode}</div>
          </div>
        )}
      </div>

      {/* Desktop: single row — matches Projects/Sites/Labour/Expenses. */}
      <div className="hidden sm:flex sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        {scoped && (
          <>
            <div className="min-w-0 flex-1">{projectNode}</div>
            <div className="w-44 shrink-0">{siteNode}</div>
          </>
        )}
        {(type === "labour" || type === "salary") && (
          <div className="min-w-0 flex-1">{workerNode}</div>
        )}
        {type === "materials" && <div className="min-w-0 flex-1">{materialNode}</div>}
        {type === "expenses" && <div className="w-44 shrink-0">{categoryNode}</div>}
        {type !== "materials" && <div className="w-40 shrink-0">{periodNode}</div>}
        {preset === "custom" && (
          <>
            <div className="w-36 shrink-0">{fromNode}</div>
            <div className="w-36 shrink-0">{toNode}</div>
          </>
        )}
      </div>

      <div className="flex flex-row justify-end">
        <Button size="sm" onClick={() => run()}>
          Run Report
        </Button>
      </div>
    </div>
  );
}
