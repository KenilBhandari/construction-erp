"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export type RunnerType =
  | "project"
  | "site"
  | "labour"
  | "materials"
  | "expenses"
  | "payments"
  | "cashflow"
  | "salary";

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
 * Run navigates to the same URL with scope params (shareable report links).
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
  const [preset, setPreset] = useState<Preset>((initial.preset as Preset) || "custom");
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
    if (type !== "site" && type !== "salary" && projectId) params.set("project", projectId);
    if (type !== "project" && type !== "payments" && type !== "cashflow" && siteId) params.set("site", siteId);
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

  const siteOptions = projectId ? projectSites : sites;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {type !== "site" && type !== "salary" && (
          <Select
            aria-label="Select project"
            className="w-44"
            value={projectId}
            onChange={(e) => {
              const pid = e.target.value;
              setProjectId(pid);
              setSiteId("");
              loadSites(pid);
              if (preset !== "custom") {
                const projectStart = projects.find((x) => x._id === pid)?.startDate;
                const [f, t] = presetRange(preset, projectStart);
                setFrom(f ?? "");
                setTo(t ?? "");
              }
            }}
          >
            <option value="">{type === "project" ? "Select project" : "All projects"}</option>
            {projects.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </Select>
        )}
        {(type === "site" || type === "labour" || type === "materials" || type === "expenses") && (
          <Select
            aria-label="Select site"
            className="w-40"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
          >
            <option value="">{type === "site" ? "Select site" : projectId ? "All sites" : "Pick project first"}</option>
            {(type === "site" ? sites : siteOptions).map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
        {(type === "labour" || type === "salary") && (
          <Select
            aria-label="Select worker"
            className="w-40"
            value={labourId}
            onChange={(e) => setLabourId(e.target.value)}
          >
            <option value="">{type === "labour" ? "Select worker" : "All workers"}</option>
            {workers.map((w) => (
              <option key={w._id} value={w._id}>
                {w.name}
              </option>
            ))}
          </Select>
        )}
        {type === "materials" && (
          <Select
            aria-label="Select material"
            className="w-44"
            value={materialId}
            onChange={(e) => setMaterialId(e.target.value)}
          >
            <option value="">Select material</option>
            {materials.map((m) => (
              <option key={m._id} value={m._id}>
                {m.name}
              </option>
            ))}
          </Select>
        )}
        {type === "expenses" && (
          <Select
            aria-label="Select category"
            className="w-40"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        )}
        <Select
          aria-label="Period preset"
          className="w-40"
          value={preset}
          onChange={(e) => applyPreset(e.target.value as Preset, projectId)}
        >
          {PRESETS.map((p) => (
            <option key={p.value} value={p.value} disabled={p.value === "lifetime" && type !== "project" && !projectId}>
              {p.label}
            </option>
          ))}
        </Select>
        {preset === "custom" && (
          <>
            <Input
              aria-label="From date"
              type="date"
              className="w-36"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <Input
              aria-label="To date"
              type="date"
              className="w-36"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </>
        )}
        <Button size="sm" onClick={() => run()}>
          Run Report
        </Button>
      </div>
      {preset === "lifetime" && !from && (
        <p className="text-xs text-text-muted">Project has no start date recorded — running lifetime (all records).</p>
      )}
    </div>
  );
}
