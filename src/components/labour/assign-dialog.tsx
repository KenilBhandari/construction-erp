"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { ComboSelect } from "@/components/ui/combo-select";
import { DateField } from "@/components/ui/date-field";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toDateInputValue } from "@/lib/utils";

interface SiteOption {
  _id: string;
  name: string;
}

/** Assign / reassign a labourer to a site. Closes the open assignment.
 * Render conditionally (only when open) so state starts fresh each time. */
export function AssignSiteDialog({
  labourId,
  labourName,
  currentSiteId,
  open,
  onClose,
  onAssigned,
}: {
  labourId: string;
  labourName: string;
  currentSiteId: string | null;
  open: boolean;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [site, setSite] = useState(currentSiteId ?? "");
  const [from, setFrom] = useState(toDateInputValue());
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sites?limit=100")
      .then(async (res) => {
        const json = await res.json();
        if (res.ok && Array.isArray(json.data)) setSites(json.data);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labour: labourId,
          site: site === "" ? null : site,
          from: from === "" ? null : from,
          notes: notes.trim() === "" ? null : notes.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Assign failed.");
      onAssigned();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  const unassigning = site === "";

  return (
    <Modal open={open} onClose={onClose} title={`Assign ${labourName}`}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <ComboSelect
          label="Site"
          required
          value={site}
          options={[
            { value: "", label: "Unassigned" },
            ...sites.map((s) => ({ value: s._id, label: s.name })),
          ]}
          onChange={setSite}
        />
        <DateField label="From date" value={from} onChange={setFrom} />
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for move…" />
        {error && (
          <p role="alert" className="text-sm text-danger">{error}</p>
        )}
        <div className="flex flex-row justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending} className="h-11 sm:h-auto">
            Cancel
          </Button>
          <Button type="submit" disabled={pending} className="h-11 sm:h-auto">
            {pending ? (unassigning ? "Removing…" : "Assigning…") : (unassigning ? "Remove from Site" : "Assign Site")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
