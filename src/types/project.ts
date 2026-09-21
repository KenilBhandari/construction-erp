export const PROJECT_STATUSES = [
  "planning",
  "active",
  "on-hold",
  "completed",
  "cancelled",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface ProjectDTO {
  _id: string;
  name: string;
  clientName: string;
  clientPhone: string | null;
  location: string;
  startDate: string | null;
  expectedEndDate: string | null;
  budget: number;
  contractValue: number;
  status: ProjectStatus;
  progress: number;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}
