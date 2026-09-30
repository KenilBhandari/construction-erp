"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ResponsiveDate } from "@/components/ui/responsive-date";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import type { AttendanceStatus } from "@/types/attendance";

interface AttendanceRow {
  _id: string;
  labour: string | { _id: string; name: string };
  site: string | { _id: string; name: string } | null;
  project: string | { _id: string; name: string } | null;
  date: string;
  status: AttendanceStatus;
  overtimeHours: number;
  notes: string | null;
}

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: "Present",
  "half-day": "Half Day",
  absent: "Absent",
};

const STATUS_TONE: Record<AttendanceStatus, "success" | "warning" | "danger"> = {
  present: "success",
  "half-day": "warning",
  absent: "danger",
};

function siteNameOf(site: AttendanceRow["site"]): string {
  if (!site) return "—";
  return typeof site === "string" ? site : site.name;
}

export function LabourAttendanceHistory({ labourId }: { labourId: string }) {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [otByDate, setOtByDate] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0,10);
      const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth()+1, 0)).toISOString().slice(0,10);
      const [attRes, otRes] = await Promise.all([
        fetch(`/api/attendance?labour=${labourId}&from=${from}&to=${to}&limit=100`),
        fetch(`/api/overtime?labour=${labourId}&from=${from}&to=${to}&limit=100`),
      ]);
      const attJson = await attRes.json();
      if (!attRes.ok) throw new Error(attJson.error ?? "Failed to load attendance");
      setRows(attJson.data ?? []);
      if (otRes.ok) {
        const otJson = await otRes.json();
        const map = new Map<string, number>();
        for (const o of (otJson.data ?? []) as Array<{ date: string; hours: number }>) {
          const key = new Date(o.date).toISOString().slice(0,10);
          map.set(key, o.hours);
        }
        setOtByDate(map);
      } else {
        setOtByDate(new Map());
      }
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labourId]);

  if (loading) {
    return (
      <Card className="rounded-xl p-4 sm:rounded-lg sm:p-5">
        <h2 className="text-[15px] font-semibold tracking-tight text-text sm:text-base sm:tracking-normal">This month attendances</h2>
        <p className="mt-3.5 text-sm text-text-muted sm:mt-3">Loading...</p>
      </Card>
    );
  }
  if (error) {
    return (
      <Card className="rounded-xl p-4 sm:rounded-lg sm:p-5">
        <h2 className="text-[15px] font-semibold tracking-tight text-text sm:text-base sm:tracking-normal">This month attendances</h2>
        <p className="mt-3.5 text-sm text-danger sm:mt-3">{error} <button className="underline" onClick={load}>Retry</button></p>
      </Card>
    );
  }
  if (rows.length === 0) return null;

 return (
    <Card className="w-full overflow-hidden rounded-xl p-4 sm:rounded-lg sm:p-5">
      <h2 className="text-[15px] font-semibold tracking-tight text-text sm:text-base sm:tracking-normal">
        This month attendances
      </h2>
      <div className="scroll-area mt-3.5 w-full max-h-[320px] overflow-y-auto sm:mt-3">
        <Table className="w-full">
          <THead>
            <TR>
              <TH className="text-xs sm:text-sm">Date</TH>
              <TH className="text-xs sm:text-sm">Status</TH>
              <TH className="text-xs sm:text-sm w-full sm:w-auto">Site</TH>
              <TH className="text-xs sm:text-sm text-right">OT</TH>
            </TR>
          </THead>
          <tbody>
            {rows.map((r) => {
              const siteLabel = siteNameOf(r.site);
              const isUnspecified = siteLabel === "—";
              const dateKey = new Date(r.date).toISOString().slice(0, 10);
              const otHours =
                Math.round(
                  ((r.overtimeHours ?? 0) + (otByDate.get(dateKey) ?? 0)) * 10
                ) / 10;
                
              return (
                <TR key={r._id}>
                  <TD className="whitespace-nowrap text-xs sm:text-sm tnum">
                    <ResponsiveDate date={r.date} />
                  </TD>
                  
                  <TD className="text-xs sm:text-sm truncate">
                    <Badge tone={STATUS_TONE[r.status]}>
                      {STATUS_LABEL[r.status]}
                    </Badge>
                  </TD>
                  
                  <TD 
                    className={`w-full max-w-0 truncate text-xs sm:w-auto sm:max-w-none sm:text-sm ${
                      isUnspecified ? "text-text-muted italic" : ""
                    }`}
                  >
                    {siteLabel}
                  </TD>
                  
                  <TD className="whitespace-nowrap text-right text-xs sm:text-sm tnum">
                    {otHours ? `${otHours}h` : <span className="text-text-muted">—</span>}
                  </TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      </div>
    </Card>
  );
}


