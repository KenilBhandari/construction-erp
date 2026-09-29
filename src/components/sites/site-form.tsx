"use client";

import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { ComboSelect } from "@/components/ui/combo-select";
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

  function siteStatusLabel(s: SiteStatus): string {
    return s === "on-hold" ? "On Hold" : s[0].toUpperCase() + s.slice(1);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 sm:gap-5">
      <section className="border border-border bg-surface rounded-lg p-3 sm:p-5">
        <h2 className="text-[15px] font-semibold text-text sm:text-base">Site Information</h2>
        <div className="mt-2.5 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-4">
          <div className="col-span-2">
            <Input label="Site Name" name="name" required value={values.name} error={errors.name} onChange={(e) => set("name", e.target.value)} placeholder="Main Building" />
          </div>
          <div className="col-span-2">
            <span className="mb-1 block text-[13px] font-medium text-text sm:text-sm">
              Project <span className="text-danger">*</span>
            </span>
            <ComboSelect
              ariaLabel="Project"
              value={values.project}
              options={[
                { value: "", label: "Select project…" },
                ...projects.map((p) => ({ value: p._id, label: p.name })),
              ]}
              onChange={(v) => set("project", v)}
            />
            {errors.project && <p className="mt-1 text-xs text-danger">{errors.project}</p>}
          </div>
          <Input label="Location" name="location" value={values.location} onChange={(e) => set("location", e.target.value)} placeholder="Block A" />
          <Input label="Supervisor" name="supervisor" value={values.supervisor} onChange={(e) => set("supervisor", e.target.value)} placeholder="Supervisor name" />
          <Input label="Start Date" name="startDate" type="date" value={values.startDate} onChange={(e) => set("startDate", e.target.value)} className="px-2 text-sm sm:px-3" />
          <Input label="Expected End Date" name="expectedEndDate" type="date" value={values.expectedEndDate} onChange={(e) => set("expectedEndDate", e.target.value)} className="px-2 text-sm sm:px-3" />
        </div>
      </section>

      <section className="border border-border bg-surface rounded-lg p-3 sm:p-5">
        <h2 className="text-[15px] font-semibold text-text sm:text-base">Status</h2>
        <div className="mt-2.5 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-4">
          <ComboSelect
            label="Status"
            value={values.status}
            options={(SITE_STATUSES as readonly SiteStatus[]).map((s) => ({
              value: s,
              label: siteStatusLabel(s),
            }))}
            onChange={(v) => set("status", v as SiteStatus)}
          />
          <Input label="Progress %" name="progress" required type="number" inputMode="numeric" min={0} max={100} value={values.progress} error={errors.progress} onChange={(e) => set("progress", e.target.value)} />
          <div className="col-span-2">
            <Textarea label="Notes" name="notes" value={values.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Notes…" />
          </div>
        </div>
      </section>

      {serverError && (
        <p role="alert" className="text-sm text-danger">{serverError}</p>
      )}

      <div>
        <Button type="submit" disabled={pending} className="h-11 w-full sm:h-auto sm:w-auto">
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
