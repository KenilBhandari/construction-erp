"use client";

import { useEffect, type ReactNode } from "react";
import { Button } from "./button";

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full border border-border bg-surface rounded-lg p-6 ${size === "xl" ? "max-w-3xl max-h-[90vh] overflow-y-auto" : size === "lg" ? "max-w-xl max-h-[90vh] overflow-y-auto" : "max-w-md"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-text">{title}</h2>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Delete",
  pending = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  pending?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {description && (
        <p className="text-sm leading-6 text-text-muted">{description}</p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={pending}>
          {pending ? "Please wait…" : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
