"use client";

import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SITE_STATUSES, type SiteStatus } from "@/types/site";

export interface SiteFormValues {
  name: string;
  project: string;
  location: string;
  supervisor: string;
  startDate: string;
  expectedEndDate: string;
  status: SiteStatus;
  progress: string;
  notes: string;
}

export interface ProjectOption {
  _id: string;
  name: string;
}

export function SiteForm({
  initial,
  projects,
  pending,
  serverError,
  submitLabel,
  onSubmit,
}: {
  initial: SiteFormValues;
  projects: ProjectOption[];
  pending: boolean;
  serverError: string | null;
  submitLabel: string;
  onSubmit: (values: SiteFormValues) => void;
}) {
  const [values, setValues] = useState<SiteFormValues>(initial);
  const [errors, setErrors] = useState<Partial<Record<"name" | "project" | "progress", string>>>({});

  function set<K extends keyof SiteFormValues>(key: K, value: SiteFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (values.name.trim().length < 2) next.name = "Site name is required.";
    if (!values.project) next.project = "Select a project.";
    const progress = Number(values.progress);
    if (values.progress === "" || progress < 0 || progress > 100)
      next.progress = "Progress must be 0–100.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <section className="border border-border bg-surface rounded-lg p-5">
        <h2 className="text-base font-semibold text-text">Site Information</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Site Name" name="name" required value={values.name} error={errors.name} onChange={(e) => set("name", e.target.value)} placeholder="Main Building" />
          <Select label="Project" name="project" required value={values.project} error={errors.project} onChange={(e) => set("project", e.target.value)}>
            <option value="">Select project…</option>
            {projects.map((p) => (
              <option key={p._id} value={p._id}>{p.name}</option>
            ))}
          </Select>
          <Input label="Location" name="location" value={values.location} onChange={(e) => set("location", e.target.value)} placeholder="Block A" />
          <Input label="Supervisor" name="supervisor" value={values.supervisor} onChange={(e) => set("supervisor", e.target.value)} placeholder="Supervisor name" />
          <Input label="Start Date" name="startDate" type="date" value={values.startDate} onChange={(e) => set("startDate", e.target.value)} />
          <Input label="Expected End Date" name="expectedEndDate" type="date" value={values.expectedEndDate} onChange={(e) => set("expectedEndDate", e.target.value)} />
        </div>
      </section>

      <section className="border border-border bg-surface rounded-lg p-5">
        <h2 className="text-base font-semibold text-text">Status</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Status" name="status" value={values.status} onChange={(e) => set("status", e.target.value as SiteStatus)}>
            {(SITE_STATUSES as readonly SiteStatus[]).map((s) => (
              <option key={s} value={s}>{s === "on-hold" ? "On Hold" : s[0].toUpperCase() + s.slice(1)}</option>
            ))}
          </Select>
          <Input label="Progress %" name="progress" required type="number" min={0} max={100} value={values.progress} error={errors.progress} onChange={(e) => set("progress", e.target.value)} />
        </div>
        <div className="mt-4">
          <Textarea label="Notes" name="notes" value={values.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Notes…" />
        </div>
      </section>

      {serverError && (
        <p role="alert" className="text-sm text-danger">{serverError}</p>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function toSitePayload(values: SiteFormValues) {
  return {
    name: values.name.trim(),
    project: values.project,
    location: values.location.trim() === "" ? null : values.location.trim(),
    supervisor: values.supervisor.trim() === "" ? null : values.supervisor.trim(),
    startDate: values.startDate === "" ? null : values.startDate,
    expectedEndDate: values.expectedEndDate === "" ? null : values.expectedEndDate,
    status: values.status,
    progress: Number(values.progress),
    notes: values.notes.trim() === "" ? null : values.notes.trim(),
  };
}
