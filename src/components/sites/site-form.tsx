"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/ui/date-field";
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

  const router = useRouter();
  const [errors, setErrors] = useState<Partial<Record<keyof SiteFormValues, string>>>({});

  function set<K extends keyof SiteFormValues>(key: K, value: SiteFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));

    // Clear the field error as soon as the user edits it.
    if (errors[key]) {
      setErrors((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:gap-6">
      <section className="border border-border bg-surface rounded-xl p-4 sm:rounded-lg sm:p-5">
        <h2 className="text-[15px] font-semibold tracking-tight text-text sm:text-base sm:tracking-normal">
          Site Information
        </h2>
        <div className="mt-3.5 grid grid-cols-2 gap-x-3 gap-y-4 sm:mt-4 sm:gap-4">
          <div className="col-span-2 sm:col-span-1">
            <Input
              label="Site Name"
              name="name"
              required
              value={values.name}
              error={errors.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Main Building"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <ComboSelect
              label="Project"
              required
              error={errors.project}
              value={values.project}
              options={[
                { value: "", label: "Select project…" },
                ...projects.map((p) => ({ value: p._id, label: p.name })),
              ]}
              onChange={(v) => set("project", v)}
              triggerClassName="h-11 text-base sm:h-[38px] sm:text-sm"
            />
          </div>
          <div className="min-w-0">
            <Input
              label="Location"
              name="location"
              value={values.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder="Block A"
            />
          </div>
          <div className="min-w-0">
            <Input
              label="Supervisor"
              name="supervisor"
              value={values.supervisor}
              onChange={(e) => set("supervisor", e.target.value)}
              placeholder="Supervisor name"
            />
          </div>
          <div className="min-w-0">
            <DateField
              label="Start Date"
              value={values.startDate}
              onChange={(v) => set("startDate", v)}
            />
          </div>
          <div className="min-w-0">
            <DateField
              label="Exp. End Date"
              value={values.expectedEndDate}
              onChange={(v) => set("expectedEndDate", v)}
              minDate={values.startDate || undefined}
            />
          </div>
        </div>
      </section>

      <section className="border border-border bg-surface rounded-xl p-4 sm:rounded-lg sm:p-5">
        <h2 className="text-[15px] font-semibold tracking-tight text-text sm:text-base sm:tracking-normal">
          Status
        </h2>
        <div className="mt-3.5 grid grid-cols-2 gap-x-3 gap-y-4 sm:mt-4 sm:gap-4">
          <div className="min-w-0">
            <ComboSelect
              label="Status"
              value={values.status}
              options={(SITE_STATUSES as readonly SiteStatus[]).map((s) => ({
                value: s,
                label: siteStatusLabel(s),
              }))}
              onChange={(v) => set("status", v as SiteStatus)}
              triggerClassName="h-11 text-base sm:h-[38px] sm:text-sm"
            />
          </div>
          <div className="min-w-0">
            <Input
              label="Progress %"
              name="progress"
              required
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              value={values.progress}
              error={errors.progress}
              onChange={(e) => set("progress", e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4">
          <Textarea
            label="Notes"
            name="notes"
            value={values.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Notes…"
          />
        </div>
      </section>

      {serverError && (
        <p role="alert" className="text-sm text-danger">
          {serverError}
        </p>
      )}

      <div className="flex flex-row justify-end gap-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pb-0">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending} className="h-11 sm:h-auto">
          Cancel
        </Button>
        <Button type="submit" disabled={pending} className="h-11 sm:h-auto">
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
