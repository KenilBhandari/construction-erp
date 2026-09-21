export const LABOUR_STATUSES = ["active", "inactive"] as const;

export type LabourStatus = (typeof LABOUR_STATUSES)[number];

/** Suggested skills (§10). Stored as free text so custom skills work. */
export const SKILL_TYPES = [
  "Mason",
  "Helper",
  "Carpenter",
  "Electrician",
  "Plumber",
  "Painter",
  "Welder",
  "Operator",
  "General Labour",
  "Other",
] as const;

export interface LabourDTO {
  _id: string;
  name: string;
  phone: string;
  photo: string | null;
  skill: string;
  dailyRate: number;
  hourlyRate: number;
  joiningDate: string | null;
  status: LabourStatus;
  assignedSite: string | { _id: string; name: string } | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export function labourSiteId(labour: LabourDTO): string | null {
  if (!labour.assignedSite) return null;
  return typeof labour.assignedSite === "string"
    ? labour.assignedSite
    : labour.assignedSite._id;
}

export function labourSiteName(labour: LabourDTO): string | null {
  if (!labour.assignedSite) return null;
  return typeof labour.assignedSite === "string"
    ? labour.assignedSite
    : labour.assignedSite.name;
}

export interface AssignmentDTO {
  _id: string;
  labour: string;
  site: { _id: string; name: string } | string;
  from: string;
  to: string | null;
  notes: string | null;
}

export function assignmentSiteName(a: AssignmentDTO): string {
  return typeof a.site === "string" ? a.site : a.site.name;
}
