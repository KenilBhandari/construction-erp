"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { formatINR } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  labour: { _id: string; name: string; hourlyRate: number };
  date: string; // yyyy-mm-dd
  sites: { _id: string; name: string }[];
  suggestedSiteId: string | null;
  existing?: { _id: string; hours: number; rate: number; notes: string | null; site?: string | { _id: string; name: string } | null } | null;
}

export function AttendanceOtModal({ open, onClose, onSaved, labour, date, sites, suggestedSiteId, existing }: Props) {
  const existingSiteId = (() => {
    if (!existing?.site) return null;
    return typeof existing.site === "string" ? existing.site : (existing.site as { _id: string })._id;
  })();
  const [siteId, setSiteId] = useState(() => existingSiteId ?? suggestedSiteId ?? "");
  const [hours, setHours] = useState(existing ? String(existing.hours) : "");
  const [rate, setRate] = useState(existing ? String(existing.rate) : "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const sId = (() => {
        if (existing?.site) return typeof existing.site === "string" ? existing.site : (existing.site as { _id: string })._id;
        return suggestedSiteId ?? "";
      })();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSiteId(sId);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHours(existing ? String(existing.hours) : "");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRate(existing ? String(existing.rate) : "");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotes(existing?.notes ?? "");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(null);
    }
  }, [open, existing, suggestedSiteId]);

  // Keep siteId in sync if suggested changes and not editing
  useEffect(() => {
    if (!existing && open && !siteId && suggestedSiteId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSiteId(suggestedSiteId);
    }
  }, [suggestedSiteId, existing, open, siteId]);

  const rateNum = rate === "" ? labour.hourlyRate : Number(rate);
  const hoursNum = Number(hours);
  const amount = !isNaN(hoursNum) && !isNaN(rateNum) && hoursNum > 0 ? Math.round(hoursNum * rateNum) : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!siteId) {
      setError("Site is required.");
      return;
    }
    if (!hours || isNaN(hoursNum) || hoursNum <= 0 || hoursNum > 24) {
      setError("Hours must be 0.1 - 24.");
      return;
    }
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        hours: hoursNum,
        rate: rate === "" ? null : Number(rate),
        notes: notes.trim() === "" ? null : notes.trim(),
        ...(existing ? { site: siteId } : { labour: labour._id, site: siteId, date }),
      };
      const url = existing ? `/api/overtime/${existing._id}` : "/api/overtime";
      const res = await fetch(url, {
        method: existing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Save failed.");
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title={existing ? "Edit Overtime" : "Add Overtime"}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="rounded-md bg-background p-3 text-sm">
          <p className="font-medium text-text">{labour.name}</p>
          <p className="text-text-muted">{date} {(siteId || suggestedSiteId) ? `· ${sites.find(s => s._id === (siteId || suggestedSiteId))?.name ?? ""}` : ""}</p>
        </div>

        <Select label="Site" required value={siteId} onChange={(e) => setSiteId(e.target.value)} disabled={pending}>
          <option value="">Select site…</option>
          {sites.map((s) => (
            <option key={s._id} value={s._id}>{s.name}</option>
          ))}
        </Select>

        <Input
          label="OT Hours"
          required
          type="number"
          max={24}
          step="any"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          placeholder="2.0"
        />
        <Input
          label={`OT Rate (₹/hr) — default ${formatINR(labour.hourlyRate)}`}
          type="number"
          min={0}
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          placeholder="Leave blank for worker's rate"
        />
        {hoursNum > 0 && (
          <p className="text-sm font-medium text-text">OT Amount = {hoursNum} × {formatINR(rateNum)} = {formatINR(amount)}</p>
        )}
        <Textarea label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason…" />
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : existing ? "Save Changes" : "Add Overtime"}</Button>
        </div>
      </form>
    </Modal>
  );
}
