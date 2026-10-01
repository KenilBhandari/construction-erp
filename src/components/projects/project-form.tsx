"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/ui/date-field";
import { ComboSelect } from "@/components/ui/combo-select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PROJECT_STATUSES, type ProjectStatus } from "@/types/project";
import { toDateInputValue } from "@/lib/utils";

export interface ProjectFormValues {
  name: string;
  clientName: string;
  clientPhone: string;
  location: string;
  startDate: string;
  expectedEndDate: string;
  budget: string;
  contractValue: string;
  status: ProjectStatus;
  progress: string;
  description: string;
}

export function emptyProjectForm(): ProjectFormValues {
  return {
    name: "",
    clientName: "",
    clientPhone: "",
    location: "",
    startDate: toDateInputValue(new Date()),
    expectedEndDate: "",
    budget: "",
    contractValue: "",
    status: "active",
    progress: "0",
    description: "",
  };
}

/** Convert ISO date string (or null) to yyyy-mm-dd for date fields (timezone-safe). */
export function isoToDateInput(value: string | null): string {
  if (!value) return "";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return "";

  // Stored dates are canonical UTC-midnight: slice the UTC calendar day
  // directly instead of local getters (which shift behind UTC).
  return d.toISOString().slice(0, 10);
}

const STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Active",
  "on-hold": "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function ProjectForm({
  initial,
  pending,
  serverError,
  submitLabel,
  onSubmit,
}: {
  initial: ProjectFormValues;
  pending: boolean;
  serverError: string | null;
  submitLabel: string;
  onSubmit: (values: ProjectFormValues) => void;
}) {
  const [values, setValues] = useState<ProjectFormValues>(initial);

  const router = useRouter();

  const [errors, setErrors] = useState<
    Partial<Record<keyof ProjectFormValues, string>>
  >({});

  function set<K extends keyof ProjectFormValues>(
    key: K,
    value: ProjectFormValues[K]
  ) {
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

    if (values.name.trim().length < 2) {
      next.name = "Project name is required.";
    }

    if (values.clientName.trim().length < 2) {
      next.clientName = "Client name is required.";
    }

    if (values.location.trim().length < 2) {
      next.location = "Location is required.";
    }

    if (values.budget === "" || Number(values.budget) < 0) {
      next.budget = "Budget must be 0 or more.";
    }

    if (
      values.contractValue === "" ||
      Number(values.contractValue) < 0
    ) {
      next.contractValue = "Contract value must be 0 or more.";
    }

    const progress = Number(values.progress);

    if (
      values.progress === "" ||
      progress < 0 ||
      progress > 100
    ) {
      next.progress = "Progress must be 0–100.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) return;

    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:gap-6">
      <section className="border border-border bg-surface rounded-xl p-4 sm:rounded-lg sm:p-5">
        <h2 className="text-[15px] font-semibold tracking-tight text-text sm:text-base sm:tracking-normal">
          Project Information
        </h2>
        <div className="mt-3.5 grid grid-cols-2 gap-x-3 gap-y-4 sm:mt-4 sm:gap-4">
          <div className="col-span-2 sm:col-span-1">
            <Input
              label="Project Name"
              name="name"
              required
              value={values.name}
              error={errors.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Patel Residence"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Input
              label="Location"
              name="location"
              required
              value={values.location}
              error={errors.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder="Ahmedabad"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Input
              label="Client Name"
              name="clientName"
              required
              value={values.clientName}
              error={errors.clientName}
              onChange={(e) => set("clientName", e.target.value)}
              placeholder="Rajesh Patel"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Input
              label="Client Phone"
              name="clientPhone"
              inputMode="tel"
              autoComplete="tel"
              value={values.clientPhone}
              onChange={(e) => set("clientPhone", e.target.value)}
              placeholder="98765 43210"
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
          Financials &amp; Status
        </h2>
        <div className="mt-3.5 grid grid-cols-2 gap-x-3 gap-y-4 sm:mt-4 sm:gap-4">
          <div className="min-w-0">
            <Input
              label="Contract Value (₹)"
              name="contractValue"
              required
              type="number"
              inputMode="decimal"
              min={0}
              value={values.contractValue}
              error={errors.contractValue}
              onChange={(e) => set("contractValue", e.target.value)}
              placeholder="2500000"
            />
          </div>
          <div className="min-w-0">
            <Input
              label="Budget (₹)"
              name="budget"
              required
              type="number"
              inputMode="decimal"
              min={0}
              value={values.budget}
              error={errors.budget}
              onChange={(e) => set("budget", e.target.value)}
              placeholder="2200000"
            />
          </div>
          <div className="min-w-0">
            <ComboSelect
              label="Status"
              value={values.status}
              options={(PROJECT_STATUSES as readonly ProjectStatus[]).map((s) => ({
                value: s,
                label: STATUS_LABELS[s],
              }))}
              onChange={(v) => set("status", v as ProjectStatus)}
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
            label="Description"
            name="description"
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Scope, notes…"
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

/** Convert form values to API payload ("" → null, strings → numbers). */
export function toProjectPayload(values: ProjectFormValues) {
  return {
    name: values.name.trim(),
    clientName: values.clientName.trim(),
    clientPhone:
      values.clientPhone.trim() === ""
        ? null
        : values.clientPhone.trim(),
    location: values.location.trim(),
    startDate:
      values.startDate === "" ? null : values.startDate,
    expectedEndDate:
      values.expectedEndDate === ""
        ? null
        : values.expectedEndDate,
    budget: Number(values.budget),
    contractValue: Number(values.contractValue),
    status: values.status,
    progress: Number(values.progress),
    description:
      values.description.trim() === ""
        ? null
        : values.description.trim(),
  };
}