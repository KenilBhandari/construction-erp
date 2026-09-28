"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MORE_GROUPS, isActive } from "./nav-data";
import { cn } from "@/lib/utils";

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Minimal sheet anchored above the dock — not a modal.
 * No scrim, no scroll lock, no centering: it rises out of the dock,
 * matches the dock width, and dismisses on navigate / Escape / tap-outside.
 */
export function MoreSheet({ open, onClose }: MoreSheetProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Close on route change (link tap navigates while open).
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="All sections"
      className="glass-panel sheet-enter absolute inset-x-0 bottom-[calc(100%+10px)] rounded-[22px] p-3"
    >
      <div className="flex flex-col gap-3">
        {MORE_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
              {group.label}
            </p>
            <ul className="mt-1 grid grid-cols-2 gap-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-2.5 py-2 text-[13px] transition-all duration-150 active:scale-[0.97]",
                        active
                          ? "border-primary/20 bg-primary-light font-medium text-primary"
                          : "border-transparent text-text hover:border-black/5 hover:bg-black/5",
                      )}
                    >
                      <Icon
                        className="h-4 w-4 shrink-0"
                        strokeWidth={active ? 2.25 : 1.75}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
