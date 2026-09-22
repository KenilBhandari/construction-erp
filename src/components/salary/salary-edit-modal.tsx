"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { formatINR } from "@/lib/utils";
import type { SalaryDTO } from "@/types/salary";

export function SalaryEditModal({
  record,
  onClose,
  onSaved,
}: {
  record: SalaryDTO;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [recovery, setRecovery] = useState(String(record.advanceRecovery));
  const [deductions, setDeductions] = useState(String(record.deductions));
  const [outstanding, setOutstanding] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const labourId = typeof record.labour === "string" ? record.labour : record.labour._id;

  useEffect(() => {
    fetch(`/api/labour/${labourId}/advance-summary`)
      .then(async (r) => {
        const j = await r.json();
        if (r.ok) setOutstanding(j.outstanding);
      })
      .catch(() => {});
  }, [labourId]);

  const available = (outstanding ?? 0) + record.advanceRecovery;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const rec = Number(recovery);
    const ded = Number(deductions);
    if (Number.isNaN(rec) || rec < 0 || Number.isNaN(ded) || ded < 0) {
      setError("Amounts must be 0 or more.");
      return;
    }
    if (outstanding !== null && rec > available) {
      setError(`Recovery ₹${rec.toLocaleString("en-IN")} exceeds available ₹${available.toLocaleString("en-IN")} (outstanding ₹${outstanding.toLocaleString("en-IN")} + current ₹${record.advanceRecovery.toLocaleString("en-IN")}).`);
      return;
    }
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/salary/${record._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advanceRecovery: rec, deductions: ded }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Update failed.");
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Edit Settlement — ${typeof record.labour === "string" ? record.labour : record.labour.name}`}>
      <div className="mb-3 rounded bg-background p-3 text-sm">
        <p className="text-text-muted">Net {formatINR(record.net)} · Gross {formatINR(record.gross + record.overtimeAmount)}</p>
        <p className="text-xs text-text-muted">Outstanding: {outstanding !== null ? formatINR(outstanding) : "…"} · Available: {outstanding !== null ? formatINR(available) : "…"} (outstanding + current recovery)</p>
        <p className="mt-1 text-[11px] text-text-muted">Recovery recovers previously given advance. 0 is valid. Once payments begin, snapshot freezes.</p>
      </div>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <Input label="Advance recovery (₹)" type="number" min={0} value={recovery} onChange={(e) => setRecovery(e.target.value)} required disabled={pending} />
        <Input label="Other deductions (₹)" type="number" min={0} value={deductions} onChange={(e) => setDeductions(e.target.value)} required disabled={pending} />
        {record.paidAmount > 0 && <p className="text-xs text-danger">This settlement has no payments yet, so recovery can be changed. Once a payment is recorded, recovery becomes locked.</p>}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save Changes"}</Button>
        </div>
      </form>
    </Modal>
  );
}
