"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateField, formatLocalDate } from "@/components/ui/date-field";
import { ComboSelect } from "@/components/ui/combo-select";
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
  /**
   * Free-form mode (Overtime tab): worker + date become selectable instead of
   * fixed. Save path is identical — the single upsert endpoint.
   */
  labourOptions?: { _id: string; name: string; hourlyRate: number }[];
}

export function AttendanceOtModal({ open, onClose, onSaved, labour, date, sites, suggestedSiteId, existing, labourOptions }: Props) {
  const freeForm = Array.isArray(labourOptions);
  const existingSiteId = (() => {
    if (!existing?.site) return null;
    return typeof existing.site === "string" ? existing.site : (existing.site as { _id: string })._id;
  })();
  const existingLabourId = (() => {
    const l = (existing as unknown as { labour?: string | { _id: string } } | null)?.labour;
    if (!l) return labour._id;
    return typeof l === "string" ? l : l._id;
  })();
  const existingDate = (existing as unknown as { date?: string | Date } | null)?.date
    ? formatLocalDate(new Date((existing as unknown as { date: string | Date }).date))
    : date;
  const [freeLabourId, setFreeLabourId] = useState(existingLabourId);
  const [freeDate, setFreeDate] = useState(existingDate);
  const [siteId, setSiteId] = useState(() => existingSiteId ?? suggestedSiteId ?? "");
  const [hours, setHours] = useState(existing ? String(existing.hours) : "");
  const [rate, setRate] = useState(existing ? String(existing.rate) : "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeLabour = freeForm
    ? (labourOptions?.find((l) => l._id === freeLabourId) ?? { _id: freeLabourId, name: "", hourlyRate: labour.hourlyRate })
    : labour;
  const activeDate = freeForm ? freeDate : date;

  useEffect(() => {
    if (open) {
      const sId = (() => {
        if (existing?.site) return typeof existing.site === "string" ? existing.site : (existing.site as { _id: string })._id;
        return suggestedSiteId ?? "";
      })();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFreeLabourId(existingLabourId);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFreeDate(existingDate);
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
  }, [open, existing, suggestedSiteId, existingLabourId, existingDate]);

  // Keep siteId in sync if suggested changes and not editing
  useEffect(() => {
    if (!existing && open && !siteId && suggestedSiteId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSiteId(suggestedSiteId);
    }
  }, [suggestedSiteId, existing, open, siteId]);

  const rateNum = rate === "" ? activeLabour.hourlyRate : Number(rate);
  const hoursNum = Number(hours);
  const amount = !isNaN(hoursNum) && !isNaN(rateNum) && hoursNum > 0 ? Math.round(hoursNum * rateNum) : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Single write path for every OT save — create-or-update the labour+day record.
    const lid = freeForm ? freeLabourId : labour._id;
    if (!lid) {
      setError("Worker is required.");
      return;
    }
    if (!activeDate) {
      setError("Date is required.");
      return;
    }
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
      // Strict create on add (duplicate day → "already exists", no silent overwrite);
      // by-id edit on existing. One modal, canonical service underneath both.
      const payload: Record<string, unknown> = {
        hours: hoursNum,
        rate: rate === "" ? null : Number(rate),
        notes: notes.trim() === "" ? null : notes.trim(),
        ...(existing ? { site: siteId } : { labour: lid, site: siteId, date: activeDate }),
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
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        {freeForm && existing ? (
          // Identity is immutable on edit (PATCH accepts hours/rate/site/notes
          // only) — show it locked instead of editable selects that silently
          // drop changes.
          <div className="rounded-md bg-background p-3 text-sm">
            <p className="font-medium text-text">
              {(() => {
                const l = (existing as unknown as { labour?: string | { _id: string; name: string } } | null)?.labour;
                return typeof l === "object" && l !== null ? l.name : activeLabour.name;
              })()}
            </p>
            <p className="text-text-muted">{existingDate}</p>
          </div>
        ) : freeForm ? (
          <>
            <ComboSelect
              label="Worker"
              required
              value={freeLabourId}
              options={labourOptions?.map((l) => ({ value: l._id, label: l.name })) ?? []}
              onChange={setFreeLabourId}
              disabled={pending}
            />
            <DateField label="Date" required value={freeDate} onChange={setFreeDate} disabled={pending} />
          </>
        ) : (
          <div className="rounded-md bg-background p-3 text-sm">
            <p className="font-medium text-text">{labour.name}</p>
            <p className="text-text-muted">{date} {(siteId || suggestedSiteId) ? `· ${sites.find(s => s._id === (siteId || suggestedSiteId))?.name ?? ""}` : ""}</p>
          </div>
        )}

        <ComboSelect
          label="Site"
          required
          value={siteId}
          options={sites.map((s) => ({ value: s._id, label: s.name }))}
          onChange={setSiteId}
          disabled={pending}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="OT Hours"
            required
            type="number"
            max={24}
            step="any"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="2.0"
            disabled={pending}
          />
          <Input
            label={`Rate (₹/hr)`}
            type="number"
            min={0}
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder={`Blank = ${formatINR(activeLabour.hourlyRate)}`}
            disabled={pending}
          />
        </div>
        {hoursNum > 0 && (
          <p className="text-sm font-medium text-text">OT Amount = {hoursNum} × {formatINR(rateNum)} = {formatINR(amount)}</p>
        )}
        <Textarea label="Notes (optional)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason…" disabled={pending} />
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending} className="h-11 sm:h-auto">Cancel</Button>
          <Button type="submit" disabled={pending} className="h-11 sm:h-auto">{pending ? "Saving…" : existing ? "Save Changes" : "Add Overtime"}</Button>
        </div>
      </form>
    </Modal>
  );
}
