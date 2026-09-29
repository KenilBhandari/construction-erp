"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComboOption {
  value: string;
  label: string;
}

/**
 * Material-style dropdown: a trigger button + popup listbox with
 * keyboard navigation. Used for filters (project status, etc.).
 * Phone: h-11 trigger, 44px option rows. Desktop: h-10, compact rows.
 * The popup is portaled to document.body with fixed positioning so it
 * escapes overflow containers (table scroll wrappers, modals).
 * Pass triggerClassName to shrink the trigger for dense rows — the
 * popup menu stays full-size and thumb-friendly.
 */
export function ComboSelect({
  label,
  ariaLabel,
  required,
  error,
  value,
  options,
  onChange,
  className,
  triggerClassName,
  disabled,
  autoOpen,
  onClose,
}: {
  label?: string;
  ariaLabel?: string;
  required?: boolean;
  error?: string;
  value: string;
  options: ComboOption[];
  onChange: (value: string) => void;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  /** Open the menu on mount (edit-mode pickers that replace a locked display). */
  autoOpen?: boolean;
  /** Fired whenever the menu closes (pick, outside click, Escape, scroll-away). */
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [pos, setPos] = useState<{ top: number; left: number; minWidth: number; maxWidth: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value);
  const listId = `combo-${(ariaLabel ?? label ?? "select").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;

  function selectedIndex(): number {
    const idx = options.findIndex((o) => o.value === value);
    return idx >= 0 ? idx : 0;
  }

  function measure(): { top: number; left: number; minWidth: number; maxWidth: number } | null {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r || typeof window === "undefined") return null;
    const H = 232; // max-h-56 + margin; flips above the trigger when cramped
    // Menu hugs the trigger but sizes to its content instead of forcing width.
    const minWidth = Math.max(r.width, 120);
    const maxWidth = Math.min(320, window.innerWidth - 16);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - minWidth - 8));
    const below = window.innerHeight - r.bottom;
    const top =
      below >= H || r.top < H ? r.bottom + 4 : Math.max(4, r.top - H);
    return { top, left, minWidth, maxWidth };
  }

  function openList() {
    const p = measure();
    if (p) setPos(p);
    setHighlight(selectedIndex());
    setOpen(true);
  }

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  function closeList() {
    setOpen(false);
    setHighlight(-1);
    onCloseRef.current?.();
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (autoOpen) openList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        closeList();
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    // Track the trigger while scrolling so the menu follows it;
    // close only once it scrolls out of view.
    const onScroll = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r || r.bottom < 0 || r.top > window.innerHeight) {
        closeList();
        return;
      }
      const p = measure();
      if (p) setPos(p);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", closeList);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", closeList);
    };
  }, [open]);

  useEffect(() => {
    if (open && highlight >= 0) {
      listRef.current
        ?.querySelector(`[data-idx="${highlight}"]`)
        ?.scrollIntoView({ block: "nearest" });
    }
  }, [open, highlight]);

  function pick(idx: number) {
    const opt = options[idx];
    if (!opt) return;
    onChange(opt.value);
    closeList();
  }

  return (
    <div className={cn("flex flex-col gap-1", className)} ref={wrapRef}>
      {label && (
        <span className="text-sm font-medium text-text">
          {label}
          {required && <span className="text-danger"> *</span>}
        </span>
      )}
      <div className="relative">
        <button
          type="button"
          ref={btnRef}
          disabled={disabled}
          aria-label={ariaLabel ?? label}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => (open ? setOpen(false) : openList())}
          onKeyDown={(e) => {
            if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              openList();
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, options.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              pick(highlight);
            } else if (e.key === "Escape") {
              closeList();
            }
          }}
          className={cn(
            "flex h-11 w-full items-center justify-between gap-2 rounded-md border border-border bg-surface pl-3.5 pr-3 text-left text-base text-text",
            "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30",
            "sm:h-10 sm:pl-3 sm:text-sm",
            triggerClassName,
            open && "border-primary ring-2 ring-primary/30",
            disabled && "opacity-50",
          )}
        >
          <span className="min-w-0 truncate">{selected?.label ?? "Select…"}</span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "h-4 w-4 shrink-0 text-text-muted transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
        {error && <p className="text-xs text-danger">{error}</p>}
        {open && pos && typeof document !== "undefined" && createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel ?? label}
            style={{ position: "fixed", top: pos.top, left: pos.left, width: "max-content", minWidth: pos.minWidth, maxWidth: pos.maxWidth, zIndex: 50 }}
            className="scroll-area max-h-56 overflow-x-hidden overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-lg"
          >
            {options.map((o, idx) => {
              const isSelected = o.value === value;
              return (
                <li
                  key={o.value}
                  data-idx={idx}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(idx);
                  }}
                  onMouseEnter={() => setHighlight(idx)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-[15px] sm:py-2 sm:text-sm",
                    idx === highlight ? "bg-primary/10 text-primary" : "text-text",
                  )}
                >
                  <span className="min-w-0 truncate">{o.label}</span>
                  {isSelected && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
      </div>
    </div>
  );
}
