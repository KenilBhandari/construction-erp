export const ATTENDANCE_STATUSES = [
  "present",
  "absent",
  "half-day",
  "leave",
] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export interface AttendanceDTO {
  _id: string;
  labour: string | { _id: string; name: string; skill: string };
  site: string | { _id: string; name: string };
  project: string | { _id: string; name: string };
  date: string;
  status: AttendanceStatus;
  checkIn: string | null;
  checkOut: string | null;
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
