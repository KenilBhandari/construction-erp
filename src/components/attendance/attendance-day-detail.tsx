"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { formatDateShort, formatINR } from "@/lib/utils";
import type { AttendanceStatus } from "@/types/attendance";
import type { OvertimeDTO } from "@/types/attendance";
import { AttendanceOtModal } from "./attendance-ot-modal";

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: "Present",
  "half-day": "Half Day",
  absent: "Absent",
};

interface RosterItem {
  labour: {
    _id: string;
    name: string;
    phone: string;
    skill: string;
    dailyRate: number;
    hourlyRate: number;
    assignedSite: string | { _id: string; name: string } | null;
  };
  attendance: {
    _id: string;
    labour: string;
    date: string;
    status: AttendanceStatus;
    site: string | { _id: string; name: string } | null;
    project: string | { _id: string; name: string } | null;
    notes: string | null;
    overtimeHours: number;
  } | null;
  suggestedSite: { _id: string; name: string } | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  item: RosterItem;
  date: string;
  sites: { _id: string; name: string }[];
  onSiteSaved: () => Promise<void>;
  onStatusChange?: () => void;
}

export function AttendanceDayDetail({ open, onClose, item, date, sites, onSiteSaved }: Props) {
  const [otRecords, setOtRecords] = useState<OvertimeDTO[] | null>(null);
  const [otLoading, setOtLoading] = useState(false);
  const [otError, setOtError] = useState<string | null>(null);
  const [showOtModal, setShowOtModal] = useState(false);
  const [editingOt, setEditingOt] = useState<OvertimeDTO | null>(null);
  const [site, setSite] = useState<string>(() => {
    const s = item.attendance?.site;
    if (!s) return "__none";
    return typeof s === "string" ? s : (s as { _id: string })._id;
  });
  const [siteSaving, setSiteSaving] = useState(false);
  const [siteSaved, setSiteSaved] = useState(false);

  useEffect(() => {
    if (open) {
      const s = item.attendance?.site;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSite(!s ? "__none" : typeof s === "string" ? s : (s as { _id: string })._id);
    }
  }, [open, item.attendance?.site]);

  const fetchOt = async () => {
    setOtLoading(true);
    setOtError(null);
    try {
      const res = await fetch(`/api/overtime?labour=${item.labour._id}&date=${date}&limit=100`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Failed to load overtime");
      setOtRecords(Array.isArray(j.data) ? j.data : []);
    } catch (e) {
      setOtError((e as Error).message);
      setOtRecords([]);
    } finally {
      setOtLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) fetchOt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item.labour._id, date]);

  const handleSiteChange = async (newSite: string) => {
    setSite(newSite);
    if (!item.attendance) return; // pending only for Not Marked (handled in parent table), here we are in detail for existing or Not Marked
    // If attendance exists, auto-save
    setSiteSaving(true);
    setSiteSaved(false);
    try {
      const res = await fetch(`/api/attendance/${item.attendance._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site: newSite === "__none" ? null : newSite }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Site update failed");
      setSiteSaved(true);
      setTimeout(() => setSiteSaved(false), 2000);
      await onSiteSaved();
    } catch (e) {
      // rollback
      const prev = item.attendance?.site ? (typeof item.attendance.site === "string" ? item.attendance.site : (item.attendance.site as { _id: string })._id) : "__none";
      setSite(prev);
      setOtError((e as Error).message);
    } finally {
      setSiteSaving(false);
    }
  };

  const handleDeleteOt = async (ot: OvertimeDTO) => {
    try {
      const res = await fetch(`/api/overtime/${ot._id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Delete failed");
      await fetchOt();
      await onSiteSaved();
    } catch (e) {
      setOtError((e as Error).message);
    }
  };

  const handleOtSaved = async () => {
    await fetchOt();
    await onSiteSaved();
  };

  if (!open) return null;
  const att = item.attendance;
  const suggestedSiteId = item.suggestedSite?._id ?? null;
  const siteForOt = att?.site ? (typeof att.site === "string" ? att.site : (att.site as { _id: string })._id) : suggestedSiteId;

  return (
    <>
      <Modal open={open} onClose={onClose} title={`${item.labour.name} — ${formatDateShort(date)}`}>
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm text-text-muted">Attendance</p>
            {att ? <Badge tone={att.status === "present" ? "success" : att.status === "half-day" ? "warning" : "danger"}>{STATUS_LABEL[att.status]}</Badge> : <Badge tone="neutral">Not Marked</Badge>}
            {att?.notes && <p className="mt-2 text-sm text-text">{att.notes}</p>}
          </div>

          <div>
            <Select label="Site" value={site} onChange={(e) => handleSiteChange(e.target.value)} disabled={siteSaving}>
              <option value="__none">No Site</option>
              {sites.map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </Select>
            {siteSaving && <p className="mt-1 text-xs text-text-muted">Saving…</p>}
            {siteSaved && <p className="mt-1 text-xs text-success">✓ Saved</p>}
            <p className="mt-1 text-xs text-text-muted">Changing site does not change current assignment.</p>
          </div>

          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-text">Overtime</p>
              {att && otRecords && otRecords.length === 0 && (
                <Button size="sm" variant="outline" onClick={() => { setEditingOt(null); setShowOtModal(true); }}>
                  + Add OT
                </Button>
              )}
              {att && otRecords && otRecords.length > 0 && (
                <span className="text-xs text-text-muted">One per day · Edit below</span>
              )}
              {!att && (
                <span className="text-xs text-text-muted">Mark attendance first</span>
              )}
            </div>
            {!att && <p className="mt-2 text-xs text-text-muted">Mark attendance before adding OT.</p>}
            {otLoading && <p className="mt-2 text-sm text-text-muted">Loading OT…</p>}
            {otError && <p className="mt-2 text-sm text-danger">{otError}</p>}
            {!otLoading && otRecords && otRecords.length === 0 && att && <p className="mt-2 text-sm text-text-muted">No overtime for this date. Add after marking attendance.</p>}
            {!otLoading && otRecords && otRecords.length > 0 && (
              <div className="mt-2 flex flex-col gap-2">
                {otRecords.map((o) => (
                  <div key={o._id} className="flex items-center justify-between rounded-md border border-border bg-background p-3 text-sm">
                    <div>
                      <p className="font-medium">{o.hours}h × {formatINR(o.rate)} = {formatINR(o.amount)}</p>
                      <p className="text-xs text-text-muted">{typeof o.site === "string" ? o.site : o.site.name} {o.notes ? `· ${o.notes}` : ""}</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" className="rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary-light" onClick={() => { setEditingOt(o); setShowOtModal(true); }}>Edit OT</button>
                      <button type="button" className="rounded px-2 py-1 text-xs font-medium text-danger hover:bg-danger/10" onClick={() => handleDeleteOt(o)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      </Modal>

      <AttendanceOtModal
        open={showOtModal}
        onClose={() => setShowOtModal(false)}
        onSaved={handleOtSaved}
        labour={item.labour}
        date={date}
        sites={sites}
        suggestedSiteId={siteForOt ?? null}
        existing={editingOt ? { _id: editingOt._id, hours: editingOt.hours, rate: editingOt.rate, notes: editingOt.notes, site: editingOt.site } : null}
      />
    </>
  );
}
