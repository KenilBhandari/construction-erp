"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { safeINR, toSafeNumber } from "@/lib/utils";
import type { SalaryDTO } from "@/types/salary";
import { PAYMENT_METHODS } from "@/types/finance";

export function SalaryPaymentModal({
  record,
  onClose,
  onSaved,
}: {
  record: SalaryDTO;
  onClose: () => void;
  onSaved: () => void;
}) {
  const remaining = toSafeNumber(
    record.remainingAmount ??
      toSafeNumber(record.net) - toSafeNumber(record.paidAmount),
    0,
  );
  const [amount, setAmount] = useState(remaining > 0 ? String(remaining) : "");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<string>("Cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idemKey] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}-${Math.random()}`,
  );

  // Lock check
  const isLocked = record.status === "paid";
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isLocked) setError("This settlement is already fully paid and locked.");
  }, [isLocked]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (isLocked) {
      setError("Paid settlements are locked.");
      return;
    }
    if (Number.isNaN(amt) || amt <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }
    if (amt > remaining) {
      setError(
        `Payment ${safeINR(amt)} exceeds remaining ${safeINR(remaining)}.`,
      );
      return;
    }
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/salary/${record._id}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": idemKey,
        },
        body: JSON.stringify({
          amount: amt,
          date,
          paymentMethod: method,
          reference: reference.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        const msg = j.error ?? "Payment failed.";
        // idempotent duplicate is success — already paid
        if (
          msg.toLowerCase().includes("duplicate") ||
          msg.toLowerCase().includes("already processed") ||
          msg.toLowerCase().includes("concurrent")
        ) {
          // refetch authoritative before closing
          onSaved();
          return;
        }
        throw new Error(msg);
      }
      onSaved();
    } catch (err) {
      const msg = (err as Error).message;
      if (
        msg.toLowerCase().includes("duplicate") ||
        msg.toLowerCase().includes("already processed")
      ) {
        onSaved();
        return;
      }
      setError(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Record Payment — ${typeof record.labour === "string" ? record.labour : record.labour.name}`}
    >
      <dl className="grid grid-cols-3 gap-3 rounded-lg bg-background p-3 text-sm">
        <div>
          <dt className="text-xs text-text-muted">Net payable</dt>
          <dd className="mt-0.5 font-semibold tnum">{safeINR(record.net)}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Already paid</dt>
          <dd className="mt-0.5 font-semibold tnum">
            {safeINR(record.paidAmount)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Remaining</dt>
          <dd className="mt-0.5 font-semibold text-primary tnum">
            {safeINR(remaining)}
          </dd>
        </div>
      </dl>
      {isLocked ? (
        <p className="mt-4 text-sm text-danger">
          This salary is locked — no further payments allowed.
        </p>
      ) : (
        <form className="mt-4 flex flex-col gap-4" onSubmit={handleSubmit}>
          <Input
            label="Amount (₹)"
            type="number"
            min={1}
            max={remaining}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            disabled={pending}
          />
          <Input
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            disabled={pending}
          />
          <Select
            label="Payment method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            disabled={pending}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
          {method !== "Cash" && (
            <Input
              label="Reference (optional)"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Txn ID / Cheque No"
              disabled={pending}
            />
          )}
          <Textarea
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Reason…"
            disabled={pending}
          />
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || isLocked}>
              {pending ? "Saving…" : "Record Payment"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
