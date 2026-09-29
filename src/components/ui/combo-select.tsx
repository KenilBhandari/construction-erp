"use client";

import { useEffect, useRef, useState } from "react";
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
 */
export function ComboSelect({
  label,
  ariaLabel,
  value,
  options,
  onChange,
  className,
}: {
  label?: string;
  ariaLabel?: string;
  value: string;
  options: ComboOption[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value);
  const listId = `combo-${(ariaLabel ?? label ?? "select").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;

  function selectedIndex(): number {
    const idx = options.findIndex((o) => o.value === value);
    return idx >= 0 ? idx : 0;
  }

  function openList() {
    setHighlight(selectedIndex());
    setOpen(true);
  }

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setHighlight(-1);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

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
    setOpen(false);
    setHighlight(-1);
  }

  return (
    <div className={cn("flex flex-col gap-1", className)} ref={wrapRef}>
      {label && (
        <span className="text-sm font-medium text-text">{label}</span>
      )}
      <div className="relative">
        <button
          type="button"
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
              setOpen(false);
              setHighlight(-1);
            }
          }}
          className={cn(
            "flex h-11 w-full items-center justify-between gap-2 rounded-md border border-border bg-surface pl-3.5 pr-3 text-left text-base text-text",
            "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30",
            "sm:h-10 sm:pl-3 sm:text-sm",
            open && "border-primary ring-2 ring-primary/30",
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
        {open && (
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel ?? label}
            className="scroll-area absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-auto rounded-md border border-border bg-surface py-1 shadow-lg"
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
          </ul>
        )}
      </div>
    </div>
  );
}
