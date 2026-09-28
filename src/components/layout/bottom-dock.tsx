"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis } from "lucide-react";
import { DOCK_ITEMS, MORE_HREFS, isActive } from "./nav-data";
import { MoreSheet } from "./more-sheet";
import { cn } from "@/lib/utils";

export function BottomDock() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const moreActive =
    !moreOpen && MORE_HREFS.some((href) => isActive(pathname, href));

  return (
    <>
      {/* Invisible tap-outside layer — no dim, no blur: the sheet stays minimal */}
      {moreOpen && (
        <button
          type="button"
          aria-label="Close all sections"
          onClick={() => setMoreOpen(false)}
          className="fixed inset-0 z-40 cursor-default bg-transparent"
        />
      )}
      <nav
        aria-label="Primary"
        className="dock-enter fixed bottom-4 left-1/2 z-50 w-[min(430px,calc(100vw-2rem))] -translate-x-1/2 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="relative">
          <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
          <div className="glass-pill flex items-center justify-around rounded-full px-3 py-2 sm:px-4">
          {DOCK_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="relative flex min-w-0 flex-col items-center gap-[3px] rounded-full px-3 py-1.5 transition-transform duration-150 active:scale-90 sm:px-4"
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full border border-primary/20 bg-primary-light"
                  />
                )}
                <Icon
                  className={cn(
                    "relative z-10 h-5 w-5 transition-colors duration-150",
                    active ? "text-primary" : "text-text-muted",
                  )}
                  strokeWidth={active ? 2.25 : 1.75}
                />
                <span
                  className={cn(
                    "relative z-10 text-[10px] font-medium transition-colors duration-150",
                    active ? "text-primary" : "text-text-muted",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            aria-label="All sections"
            className="relative flex min-w-0 cursor-pointer flex-col items-center gap-[3px] rounded-full px-3 py-1.5 transition-transform duration-150 active:scale-90 sm:px-4"
          >
            {moreOpen && (
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-full border border-primary/20 bg-primary-light"
              />
            )}
            <span className="relative z-10">
              <Ellipsis
                className={cn(
                  "h-5 w-5 transition-colors duration-150",
                  moreOpen || moreActive ? "text-primary" : "text-text-muted",
                )}
                strokeWidth={moreOpen || moreActive ? 2.25 : 1.75}
              />
              {moreActive && (
                <span
                  aria-hidden="true"
                  className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary"
                />
              )}
            </span>
            <span
              className={cn(
                "relative z-10 text-[10px] font-medium transition-colors duration-150",
                moreOpen || moreActive ? "text-primary" : "text-text-muted",
              )}
            >
              More
            </span>
          </button>
          </div>
        </div>
      </nav>
    </>
  );
}
