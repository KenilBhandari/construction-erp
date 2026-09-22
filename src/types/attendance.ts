export const ATTENDANCE_STATUSES = ["present", "half-day", "absent"] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export interface AttendanceDTO {
  _id: string;
  labour: string | { _id: string; name: string; skill: string; phone?: string };
  site: string | { _id: string; name: string } | null;
  project: string | { _id: string; name: string } | null;
  date: string;
  status: AttendanceStatus;
  overtimeHours: number;
  notes: string | null;
}

export interface OvertimeDTO {
  _id: string;
  labour: string | { _id: string; name: string };
  site: string | { _id: string; name: string };
  project: string | { _id: string; name: string };
  date: string;
  hours: number;
  rate: number;
  amount: number;
  notes: string | null;
}
