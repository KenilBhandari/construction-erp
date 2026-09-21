"use client";

import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  LABOUR_STATUSES,
  SKILL_TYPES,
  type LabourStatus,
} from "@/types/labour";

export interface LabourFormValues {
  name: string;
  phone: string;
  photo: string;
  skill: string;
  dailyRate: string;
  hourlyRate: string;
  joiningDate: string;
  status: LabourStatus;
  assignedSite: string;
  notes: string;
}

export function emptyLabourForm(): LabourFormValues {
  return {
    name: "",
    phone: "",
    photo: "",
    skill: "",
    dailyRate: "",
    hourlyRate: "",
    joiningDate: "",
    status: "active",
    assignedSite: "",
    notes: "",
  };
}

export interface SiteOption {
  _id: string;
  name: string;
}

export function LabourForm({
  initial,
  sites,
  mode,
  pending,
  serverError,
  submitLabel,
  onSubmit,
}: {
  initial: LabourFormValues;
  sites: SiteOption[];
  mode: "create" | "edit";
  pending: boolean;
  serverError: string | null;
  submitLabel: string;
  onSubmit: (values: LabourFormValues) => void;
}) {
  const [values, setValues] = useState<LabourFormValues>(initial);
  const [errors, setErrors] = useState<
    Partial<Record<"name" | "phone" | "skill" | "dailyRate" | "hourlyRate", string>>
  >({});

  function set<K extends keyof LabourFormValues>(key: K, value: LabourFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (values.name.trim().length < 2) next.name = "Name is required.";
    if (values.phone.trim().length < 6) next.phone = "Phone looks too short.";
    if (values.skill.trim().length < 2) next.skill = "Skill is required.";
    if (values.dailyRate === "" || Number(values.dailyRate) < 0)
      next.dailyRate = "Daily rate must be 0 or more.";
    if (values.hourlyRate === "" || Number(values.hourlyRate) < 0)
      next.hourlyRate = "Hourly rate must be 0 or more.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <section className="border border-border bg-surface rounded-lg p-5">
        <h2 className="text-base font-semibold text-text">Basic Information</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Name" name="name" required value={values.name} error={errors.name} onChange={(e) => set("name", e.target.value)} placeholder="Ramesh Kumar" />
          <Input label="Phone" name="phone" required value={values.phone} error={errors.phone} onChange={(e) => set("phone", e.target.value)} placeholder="98765 43210" />
          <div className="flex flex-col gap-1">
            <label htmlFor="skill" className="text-sm font-medium text-text">
              Skill <span className="text-danger">*</span>
            </label>
            <input
              id="skill"
              name="skill"
              list="skill-suggestions"
              value={values.skill}
              onChange={(e) => set("skill", e.target.value)}
              placeholder="Mason — or type a custom skill"
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
            />
            <datalist id="skill-suggestions">
              {SKILL_TYPES.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            {errors.skill && <p className="text-xs text-danger">{errors.skill}</p>}
          </div>
          <Input label="Joining Date" name="joiningDate" type="date" value={values.joiningDate} onChange={(e) => set("joiningDate", e.target.value)} />
          <Input label="Photo URL (optional)" name="photo" value={values.photo} onChange={(e) => set("photo", e.target.value)} placeholder="https://" />
          <Select label="Status" name="status" value={values.status} onChange={(e) => set("status", e.target.value as LabourStatus)}>
            {(LABOUR_STATUSES as readonly LabourStatus[]).map((s) => (
              <option key={s} value={s}>{s === "active" ? "Active" : "Inactive"}</option>
            ))}
          </Select>
        </div>
      </section>

      <section className="border border-border bg-surface rounded-lg p-5">
        <h2 className="text-base font-semibold text-text">Rates &amp; Site</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Daily Rate (₹)" name="dailyRate" required type="number" min={0} value={values.dailyRate} error={errors.dailyRate} onChange={(e) => set("dailyRate", e.target.value)} placeholder="900" />
          <Input label="OT Hourly Rate (₹)" name="hourlyRate" required type="number" min={0} value={values.hourlyRate} error={errors.hourlyRate} onChange={(e) => set("hourlyRate", e.target.value)} placeholder="120" />
          {mode === "create" ? (
            <Select label="Assigned Site" name="assignedSite" value={values.assignedSite} onChange={(e) => set("assignedSite", e.target.value)}>
              <option value="">No site yet</option>
              {sites.map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </Select>
          ) : (
            <p className="text-sm leading-6 text-text-muted sm:pt-7">
              Site changes use Assign Site — it keeps history intact.
            </p>
          )}
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

/** Create payload (includes optional site). */
export function toLabourCreatePayload(values: LabourFormValues) {
  return {
    name: values.name.trim(),
    phone: values.phone.trim(),
    photo: values.photo.trim() === "" ? null : values.photo.trim(),
    skill: values.skill.trim(),
    dailyRate: Number(values.dailyRate),
    hourlyRate: Number(values.hourlyRate),
    joiningDate: values.joiningDate === "" ? null : values.joiningDate,
    status: values.status,
    assignedSite: values.assignedSite === "" ? null : values.assignedSite,
    notes: values.notes.trim() === "" ? null : values.notes.trim(),
  };
}

/** Edit payload (site excluded — moves go through /api/assignments). */
export function toLabourEditPayload(values: LabourFormValues) {
  return {
    name: values.name.trim(),
    phone: values.phone.trim(),
    photo: values.photo.trim() === "" ? null : values.photo.trim(),
    skill: values.skill.trim(),
    dailyRate: Number(values.dailyRate),
    hourlyRate: Number(values.hourlyRate),
    joiningDate: values.joiningDate === "" ? null : values.joiningDate,
    status: values.status,
    notes: values.notes.trim() === "" ? null : values.notes.trim(),
  };
}
