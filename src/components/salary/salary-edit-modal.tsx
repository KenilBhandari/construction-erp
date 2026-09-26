"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { safeINR, toSafeNumber } from "@/lib/utils";
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

  const isLocked = record.status !== "pending";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLocked) {
      setError("Only pending settlements can be edited — this record is locked.");
      return;
    }
    const rec = Number(recovery);
    const ded = Number(deductions);
    if (Number.isNaN(rec) || rec < 0 || Number.isNaN(ded) || ded < 0) {
      setError("Amounts must be 0 or more.");
      return;
    }
    if (outstanding !== null && rec > available) {
      setError(`Recovery ${safeINR(rec)} exceeds available ${safeINR(available)} (outstanding ${safeINR(outstanding)} + current ${safeINR(record.advanceRecovery)}).`);
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

  const showOutstanding = outstanding !== null && (outstanding > 0 || available > 0);

  return (
    <Modal open onClose={onClose} title={`Edit Settlement — ${typeof record.labour === "string" ? record.labour : record.labour.name}`}>
      <dl className="mb-4 grid grid-cols-3 gap-3 rounded-lg bg-background p-3 text-sm">
        <div><dt className="text-xs text-text-muted">Net</dt><dd className="mt-0.5 font-semibold text-primary tnum">{safeINR(record.net)}</dd></div>
        <div><dt className="text-xs text-text-muted">Gross</dt><dd className="mt-0.5 font-semibold tnum">{safeINR(toSafeNumber(record.gross) + toSafeNumber(record.overtimeAmount))}</dd></div>
        <div><dt className="text-xs text-text-muted">Paid</dt><dd className="mt-0.5 font-semibold tnum">{safeINR(record.paidAmount)}</dd></div>
        {showOutstanding && (
          <>
            <div><dt className="text-xs text-text-muted">Outstanding</dt><dd className="mt-0.5 font-medium tnum">{safeINR(outstanding)}</dd></div>
            <div className="col-span-2"><dt className="text-xs text-text-muted">Available</dt><dd className="mt-0.5 font-medium tnum">{safeINR(available)}</dd></div>
          </>
        )}
      </dl>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <Input label="Advance recovery (₹)" type="number" min={0} value={recovery} onChange={(e) => setRecovery(e.target.value)} required disabled={pending || isLocked} />
        <Input label="Other deductions (₹)" type="number" min={0} value={deductions} onChange={(e) => setDeductions(e.target.value)} required disabled={pending || isLocked} />
        {isLocked && (
          <p className="text-xs text-warning">This settlement is locked — payments have been recorded.</p>
        )}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" disabled={pending || isLocked}>{pending ? "Saving…" : "Save Changes"}</Button>
        </div>
      </form>
    </Modal>
  );
}
