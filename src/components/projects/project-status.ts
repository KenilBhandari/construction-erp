import type { ProjectStatus } from "@/types/project";

/** Status → Badge tone + label. Shared by list and detail (no React imports). */
const STATUS_TONE: Record<
  ProjectStatus,
  "neutral" | "primary" | "success" | "warning" | "danger"
> = {
  planning: "neutral",
  active: "primary",
  "on-hold": "warning",
  completed: "success",
  cancelled: "danger",
};

const STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Active",
  "on-hold": "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function statusTone(status: ProjectStatus) {
  return STATUS_TONE[status];
}

export function statusLabel(status: ProjectStatus) {
  return STATUS_LABEL[status];
}
