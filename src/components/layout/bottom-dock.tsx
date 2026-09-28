"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_AREAS, activeArea } from "./nav-data";
import { useGlide } from "./use-glide";
import { cn } from "@/lib/utils";

export function BottomDock() {
  const pathname = usePathname();
  const area = activeArea(pathname);

  // Optimistic focus: glide the instant a slot is tapped, without
  // waiting for the route to render.
  const [pressed, setPressed] = useState<{ label: string; at: string } | null>(
    null,
  );
  const effectiveLabel =
    pressed && pressed.at === pathname ? pressed.label : area?.label;
  const activeIndex = Math.max(
    0,
    NAV_AREAS.findIndex((a) => a.label === effectiveLabel),
  );
  const { containerRef, setItemRef, pill } = useGlide(activeIndex);

  return (
    <nav
      aria-label="Primary"
      className="dock-enter fixed bottom-4 left-1/2 z-50 w-[min(460px,calc(100vw-2rem))] -translate-x-1/2 pb-[env(safe-area-inset-bottom)]"
    >
      <div
        ref={containerRef}
        className="glass-dock relative flex items-stretch justify-around rounded-full p-1.5"
      >
        {/* Module pill: solid orange, glides between slots */}
        <span
          aria-hidden="true"
          className="glide-pill dock-pill pointer-events-none absolute left-0 top-0 rounded-full"
          style={{
            transform: `translate(${pill.x}px, ${pill.y}px)`,
            width: pill.w,
            height: pill.h,
            opacity: pill.ready && effectiveLabel !== undefined ? 1 : 0,
            transition: pill.animate ? undefined : "none",
          }}
        />

        {NAV_AREAS.map((item, i) => {
          const Icon = item.icon;
          const isCurrent = item.label === effectiveLabel;
          return (
            <Link
              key={item.label}
              ref={setItemRef(i)}
              href={item.href}
              onClick={() => setPressed({ label: item.label, at: pathname })}
              aria-current={isCurrent ? "page" : undefined}
              className="relative z-10 flex min-w-0 flex-1 flex-col items-center gap-[3px] rounded-full px-1 py-1.5 outline-none transition-transform duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <Icon
                className={cn(
                  "h-[22px] w-[22px] transition-colors duration-300",
                  isCurrent ? "text-white" : "text-text-muted",
                )}
                strokeWidth={isCurrent ? 2.2 : 1.8}
              />
              <span
                className={cn(
                  "max-w-full truncate text-[10px] leading-none transition-colors duration-300",
                  isCurrent
                    ? "font-semibold text-white"
                    : "font-medium text-text-muted",
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}