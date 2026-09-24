export const SITE_STATUSES = ["active", "on-hold", "completed", "inactive"] as const;

export type SiteStatus = (typeof SITE_STATUSES)[number];

export interface SiteDTO {
  _id: string;
  name: string;
  project: string | { _id: string; name: string };
  location: string | null;
  supervisor: string | null;
  startDate: string | null;
  expectedEndDate: string | null;
  status: SiteStatus;
  progress: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export function siteProjectId(site: SiteDTO): string {
  return typeof site.project === "string" ? site.project : site.project._id;
}

export function siteProjectName(site: SiteDTO): string {
  return typeof site.project === "string" ? site.project : site.project.name;
}
