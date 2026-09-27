"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export interface ReportsFilterValue {
  from: string;
  to: string;
  projectId: string;
  siteId: string;
  labourId: string;
  materialId: string;
}

/** Global report filters — compact one-row bar, applied via URL params (shareable scope). */
export function ReportsFilters({
  projects,
  workers,
  materials,
  initial,
}: {
  projects: { _id: string; name: string }[];
  workers: { _id: string; name: string }[];
  materials: { _id: string; name: string }[];
  initial: ReportsFilterValue;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [projectId, setProjectId] = useState(initial.projectId);
  const [siteId, setSiteId] = useState(initial.siteId);
  const [labourId, setLabourId] = useState(initial.labourId);
  const [materialId, setMaterialId] = useState(initial.materialId);
  const [sites, setSites] = useState<{ _id: string; name: string }[]>([]);

  useEffect(() => {
    if (!projectId) {
      setSites([]);
      return;
    }
    fetch(`/api/sites?project=${projectId}&limit=100`)
      .then(async (r) => r.json())
      .then((j) => {
        if (Array.isArray(j.data)) setSites(j.data);
      })
      .catch(() => {});
  }, [projectId]);

  function apply(next: ReportsFilterValue) {
    const params = new URLSearchParams();
    if (next.from) params.set("from", next.from);
    if (next.to) params.set("to", next.to);
    if (next.projectId) params.set("project", next.projectId);
    if (next.siteId) params.set("site", next.siteId);
    if (next.labourId) params.set("worker", next.labourId);
    if (next.materialId) params.set("material", next.materialId);
    const qs = params.toString();
    router.replace(`/dashboard/reports${qs ? `?${qs}` : ""}`);
  }

  function clear() {
    setFrom("");
    setTo("");
    setProjectId("");
    setSiteId("");
    setLabourId("");
    setMaterialId("");
    setSites([]);
    router.replace("/dashboard/reports");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        aria-label="From date"
        type="date"
        className="w-36"
        value={from}
        onChange={(e) => {
          setFrom(e.target.value);
          apply({ from: e.target.value, to, projectId, siteId, labourId, materialId });
        }}
      />
      <Input
        aria-label="To date"
        type="date"
        className="w-36"
        value={to}
        onChange={(e) => {
          setTo(e.target.value);
          apply({ from, to: e.target.value, projectId, siteId, labourId, materialId });
        }}
      />
      <Select
        aria-label="Filter by project"
        className="w-44"
        value={projectId}
        onChange={(e) => {
          setProjectId(e.target.value);
          setSiteId("");
          setSites([]);
          apply({ from, to, projectId: e.target.value, siteId: "", labourId, materialId });
        }}
      >
        <option value="">All projects</option>
        {projects.map((p) => (
          <option key={p._id} value={p._id}>
            {p.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by site"
        className="w-40"
        value={siteId}
        onChange={(e) => {
          setSiteId(e.target.value);
          apply({ from, to, projectId, siteId: e.target.value, labourId, materialId });
        }}
      >
        <option value="">{projectId ? "All sites" : "Pick project first"}</option>
        {sites.map((s) => (
          <option key={s._id} value={s._id}>
            {s.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by worker"
        className="w-40"
        value={labourId}
        onChange={(e) => {
          setLabourId(e.target.value);
          apply({ from, to, projectId, siteId, labourId: e.target.value, materialId });
        }}
      >
        <option value="">All workers</option>
        {workers.map((w) => (
          <option key={w._id} value={w._id}>
            {w.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by material"
        className="w-40"
        value={materialId}
        onChange={(e) => {
          setMaterialId(e.target.value);
          apply({ from, to, projectId, siteId, labourId, materialId: e.target.value });
        }}
      >
        <option value="">All materials</option>
        {materials.map((m) => (
          <option key={m._id} value={m._id}>
            {m.name}
          </option>
        ))}
      </Select>
      {(from || to || projectId || siteId || labourId || materialId) && (
        <Button variant="outline" size="sm" onClick={clear}>
          Clear
        </Button>
      )}
    </div>
  );
}
