"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
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
    joiningDate: new Date().toISOString().slice(0, 10),
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
  const [skillOpen, setSkillOpen] = useState(false);
  const [skillHighlight, setSkillHighlight] = useState(-1);
  const skillWrapRef = useRef<HTMLDivElement>(null);

  const skillOptions = SKILL_TYPES.filter((s) => s !== "Other");
  const filteredSkills = values.skill.trim() === ""
    ? skillOptions
    : skillOptions.filter((s) => s.toLowerCase().includes(values.skill.trim().toLowerCase()));

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (skillWrapRef.current && !skillWrapRef.current.contains(e.target as Node)) {
        setSkillOpen(false);
        setSkillHighlight(-1);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

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
          <div className="flex flex-col gap-1" ref={skillWrapRef}>
            <label htmlFor="skill" className="text-sm font-medium text-text">
              Skill <span className="text-danger">*</span>
            </label>
            <div className="relative">
              <input
                id="skill"
                name="skill"
                value={values.skill}
                onChange={(e) => {
                  set("skill", e.target.value);
                  setSkillOpen(true);
                  setSkillHighlight(-1);
                }}
                onFocus={() => {
                  setSkillOpen(true);
                  setSkillHighlight(-1);
                }}
                onClick={() => {
                  setSkillOpen(true);
                  setSkillHighlight(-1);
                }}
                onKeyDown={(e) => {
                  if (!skillOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                    setSkillOpen(true);
                    setSkillHighlight(0);
                    e.preventDefault();
                    return;
                  }
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSkillHighlight((h) => Math.min(h + 1, filteredSkills.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSkillHighlight((h) => Math.max(h - 1, 0));
                  } else if (e.key === "Enter") {
                    if (skillHighlight >= 0 && skillHighlight < filteredSkills.length) {
                      e.preventDefault();
                      set("skill", filteredSkills[skillHighlight]);
                      setSkillOpen(false);
                      setSkillHighlight(-1);
                    }
                  } else if (e.key === "Escape") {
                    setSkillOpen(false);
                    setSkillHighlight(-1);
                  }
                }}
                placeholder="Select or type a skill"
                autoComplete="off"
                aria-autocomplete="list"
                aria-expanded={skillOpen}
                aria-controls="skill-suggestions-list"
                className={`w-full rounded-md border bg-surface px-3 py-2 pr-8 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none ${errors.skill ? "border-danger" : "border-border"}`}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-text-muted opacity-60">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4 L6 8 L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
              {skillOpen && filteredSkills.length > 0 && (
                <ul
                  id="skill-suggestions-list"
                  role="listbox"
                  className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-auto rounded-md border border-border bg-surface shadow-md"
                >
                  {filteredSkills.map((s, idx) => (
                    <li
                      key={s}
                      role="option"
                      aria-selected={idx === skillHighlight}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        set("skill", s);
                        setSkillOpen(false);
                        setSkillHighlight(-1);
                      }}
                      onMouseEnter={() => setSkillHighlight(idx)}
                      className={`cursor-pointer px-3 py-2 text-sm ${idx === skillHighlight ? "bg-primary/10 text-primary" : "text-text hover:bg-background"}`}
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {errors.skill && <p className="text-xs text-danger">{errors.skill}</p>}
          </div>
          <Input label="Joining Date" name="joiningDate" type="date" value={values.joiningDate} onChange={(e) => set("joiningDate", e.target.value)} />
        </div>
      </section>

      <section className="border border-border bg-surface rounded-lg p-5">
        <h2 className="text-base font-semibold text-text">Rates &amp; Site</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Daily Rate (₹)" name="dailyRate" required type="number" min={0} value={values.dailyRate} error={errors.dailyRate} onChange={(e) => set("dailyRate", e.target.value)} placeholder="900" />
          <Input label="OT Hourly Rate (₹)" name="hourlyRate" required type="number" min={0} value={values.hourlyRate} error={errors.hourlyRate} onChange={(e) => set("hourlyRate", e.target.value)} placeholder="120" />
          {mode === "create" && (
            <>
              <Select label="Assigned Site" name="assignedSite" value={values.assignedSite} onChange={(e) => set("assignedSite", e.target.value)}>
                <option value="">No site yet</option>
                {sites.map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </Select>
              <Select label="Status" name="status" value={values.status} onChange={(e) => set("status", e.target.value as LabourStatus)}>
                {(LABOUR_STATUSES as readonly LabourStatus[]).map((s) => (
                  <option key={s} value={s}>{s === "active" ? "Active" : "Inactive"}</option>
                ))}
              </Select>
            </>
          )}
        </div>
        {mode === "edit" && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Status" name="status" value={values.status} onChange={(e) => set("status", e.target.value as LabourStatus)}>
              {(LABOUR_STATUSES as readonly LabourStatus[]).map((s) => (
                <option key={s} value={s}>{s === "active" ? "Active" : "Inactive"}</option>
              ))}
            </Select>
          </div>
        )}
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
