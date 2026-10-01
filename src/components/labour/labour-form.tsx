"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ComboSelect } from "@/components/ui/combo-select";
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

const STATUS_LABELS: Record<LabourStatus, string> = {
  active: "Active",
  inactive: "Inactive",
};

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

  const router = useRouter();
  const [errors, setErrors] = useState<
    Partial<Record<keyof LabourFormValues, string>>
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:gap-6">
      <section className="border border-border bg-surface rounded-xl p-4 sm:rounded-lg sm:p-5">
        <h2 className="text-[15px] font-semibold tracking-tight text-text sm:text-base sm:tracking-normal">
          Basic Information
        </h2>
        <div className="mt-3.5 grid grid-cols-2 gap-x-3 gap-y-4 sm:mt-4 sm:gap-4">
          <div className="col-span-2 sm:col-span-1">
            <Input
              label="Name"
              name="name"
              required
              value={values.name}
              error={errors.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ramesh Kumar"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Input
              label="Phone"
              name="phone"
              required
              inputMode="tel"
              autoComplete="tel"
              value={values.phone}
              error={errors.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="98765 43210"
            />
          </div>
          <div className="min-w-0">
            <div className="flex flex-col gap-1" ref={skillWrapRef}>
              <label htmlFor="skill" className="text-[13px] font-medium text-text sm:text-sm">
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
                  className={`h-11 w-full min-w-0 rounded-md border bg-surface px-3.5 pr-10 text-base text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 sm:h-auto sm:px-3 sm:py-2 sm:text-sm ${errors.skill ? "border-danger" : "border-border"}`}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-text-muted">
                  <ChevronDown className={`h-4 w-4 transition-transform ${skillOpen ? "rotate-180" : ""}`} />
                </span>
                {skillOpen && filteredSkills.length > 0 && (
                  <ul
                    id="skill-suggestions-list"
                    role="listbox"
                    className="scroll-area absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-auto rounded-md border border-border bg-surface py-1 shadow-lg"
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
                        className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-[15px] sm:py-2 sm:text-sm ${idx === skillHighlight ? "bg-primary/10 text-primary" : "text-text"}`}
                      >
                        <span className="min-w-0 truncate">{s}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {errors.skill && <p className="text-xs text-danger">{errors.skill}</p>}
            </div>
          </div>
          <div className="min-w-0">
            <Input
              label="Joining Date"
              name="joiningDate"
              type="date"
              value={values.joiningDate}
              onChange={(e) => set("joiningDate", e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="border border-border bg-surface rounded-xl p-4 sm:rounded-lg sm:p-5">
        <h2 className="text-[15px] font-semibold tracking-tight text-text sm:text-base sm:tracking-normal">
          Rates &amp; Site
        </h2>
        <div className="mt-3.5 grid grid-cols-2 gap-x-3 gap-y-4 sm:mt-4 sm:gap-4">
          <div className="min-w-0">
            <Input
              label="Daily Rate (₹)"
              name="dailyRate"
              required
              type="number"
              inputMode="decimal"
              min={0}
              value={values.dailyRate}
              error={errors.dailyRate}
              onChange={(e) => set("dailyRate", e.target.value)}
              placeholder="900"
            />
          </div>
          <div className="min-w-0">
            <Input
              label="OT Hourly Rate (₹)"
              name="hourlyRate"
              required
              type="number"
              inputMode="decimal"
              min={0}
              value={values.hourlyRate}
              error={errors.hourlyRate}
              onChange={(e) => set("hourlyRate", e.target.value)}
              placeholder="120"
            />
          </div>
          {mode === "create" && (
            <>
              <div className="min-w-0">
                <ComboSelect
                  label="Assigned Site"
                  value={values.assignedSite}
                  options={[
                    { value: "", label: "Unassigned" },
                    ...sites.map((s) => ({ value: s._id, label: s.name })),
                  ]}
                  onChange={(v) => set("assignedSite", v)}
                  triggerClassName="h-11 text-base sm:h-[38px] sm:text-sm"
                />
              </div>
              <div className="min-w-0">
                <ComboSelect
                  label="Status"
                  value={values.status}
                  options={(LABOUR_STATUSES as readonly LabourStatus[]).map((s) => ({
                    value: s,
                    label: STATUS_LABELS[s],
                  }))}
                  onChange={(v) => set("status", v as LabourStatus)}
                  triggerClassName="h-11 text-base sm:h-[38px] sm:text-sm"
                />
              </div>
            </>
          )}
          {mode === "edit" && (
            <div className="min-w-0">
              <ComboSelect
                label="Status"
                value={values.status}
                options={(LABOUR_STATUSES as readonly LabourStatus[]).map((s) => ({
                  value: s,
                  label: STATUS_LABELS[s],
                }))}
                onChange={(v) => set("status", v as LabourStatus)}
                triggerClassName="h-11 text-base sm:h-[38px] sm:text-sm"
              />
            </div>
          )}
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
