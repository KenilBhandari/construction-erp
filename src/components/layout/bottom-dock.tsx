"use client";

import { useState } from "react";
import type { MouseEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { NAV_AREAS, activeArea, isActive } from "./nav-data";
import { useGlide } from "./use-glide";
import { cn } from "@/lib/utils";

type NavArea = (typeof NAV_AREAS)[number];

export function BottomDock() {
  const pathname = usePathname();

  // Optimistic path: the UI reacts on tap, before the route renders.
  const [pending, setPending] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    // Navigation finished: drop all optimistic / manual state.
    setPrevPath(pathname);
    setPending(null);
    setDismissed(false);
  }

  const livePath = pending ?? pathname;
  const area = activeArea(livePath);
  const openLabel =
    !dismissed && area && area.children.length > 0 ? area.label : undefined;
  const openArea = NAV_AREAS.find((a) => a.label === openLabel);
  const inSubnav = openArea !== undefined;

  // Keep the last open area rendered while the track slides back out.
  const [retained, setRetained] = useState<NavArea | undefined>(openArea);
  if (openArea && openArea !== retained) setRetained(openArea);
  const subArea = openArea ?? retained;

  // ---- glides ----
  const mainIndex = area
    ? NAV_AREAS.findIndex((a) => a.label === area.label)
    : -1;
  const {
    containerRef: mainBarRef,
    setItemRef: mainItemRef,
    pill: mainPill,
  } = useGlide(mainIndex);

  const subIndex = subArea
    ? subArea.children.findIndex((s) => isActive(livePath, s.href))
    : -1;
  const {
    containerRef: subBarRef,
    setItemRef: subItemRef,
    pill: subPill,
  } = useGlide(subIndex, subArea?.label ?? "");

  // Ignore new-tab / modified clicks so we never show a wrong optimistic state.
  const go = (href: string) => (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    setPending(href);
    setDismissed(false);
  };

  return (
    <nav
      aria-label="Primary"
      className="dock-enter fixed bottom-4 left-1/2 z-50 w-[min(440px,calc(100vw-1.5rem))] -translate-x-1/2 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="glass-dock isolate h-[58px] overflow-clip rounded-full">
        <div className={cn("dock-track flex h-full w-[200%]", inSubnav && "sub")}>
          {/* ---------- State A: modules ---------- */}
          <div
            ref={mainBarRef}
            inert={inSubnav}
            className={cn(
              "dock-panel relative flex h-full w-1/2 items-stretch p-1.5",
              inSubnav && "dock-panel-hidden",
            )}
          >
            <span
              aria-hidden="true"
              className="glide-pill dock-pill pointer-events-none absolute left-0 top-0 rounded-full"
              style={{
                transform: `translate(${mainPill.x}px, ${mainPill.y}px)`,
                width: mainPill.w,
                height: mainPill.h,
                opacity: mainPill.ready ? 1 : 0,
                transition: mainPill.animate ? undefined : "none",
              }}
            />
            {NAV_AREAS.map((item, i) => {
              const Icon = item.icon;
              const isCurrent = i === mainIndex;
              return (
                <Link
                  key={item.label}
                  ref={mainItemRef(i)}
                  href={item.href}
                  onClick={go(item.href)}
                  aria-current={isCurrent ? "page" : undefined}
                  className="relative z-10 flex min-w-0 flex-1 flex-col items-center justify-center gap-[3px] rounded-full px-1 outline-none transition-transform duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/60"
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

          {/* ---------- State B: parent + sub-pills ---------- */}
        {/* ---------- State B: parent + sub-pills ---------- */}
<div
  inert={!inSubnav}
  className={cn(
    "dock-panel flex h-full w-1/2 items-center gap-1.5 p-1.5",
    !inSubnav && "dock-panel-hidden",
  )}
>
  {subArea && (
    <>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={`Back to main navigation (from ${subArea.label})`}
        title={subArea.label}
        className="flex h-full w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary-light text-primary outline-none transition-transform duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        <ChevronLeft className="h-4 w-4 shrink-0 -ml-0.5" strokeWidth={2.6} />
        <subArea.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2.1} />
      </button>

      <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border" />

      {/* Row fills all remaining space; items share it, no scrolling */}
      <div
        ref={subBarRef}
        className="relative flex h-full min-w-0 flex-1 items-stretch gap-0.5"
      >
        <span
          aria-hidden="true"
          className="glide-pill dock-subpill pointer-events-none absolute left-0 top-0 rounded-full"
          style={{
            transform: `translate(${subPill.x}px, ${subPill.y}px)`,
            width: subPill.w,
            height: subPill.h,
            opacity: subPill.ready ? 1 : 0,
            transition: subPill.animate ? undefined : "none",
          }}
        />
        {subArea.children.map((s, i) => {
          const isCurrent = i === subIndex;
          return (
            <Link
              key={s.href}
              ref={subItemRef(i)}
              href={s.href}
              onClick={go(s.href)}
              aria-current={isCurrent ? "page" : undefined}
              title={s.label}
              className={cn(
                // basis-auto + grow + shrink: content-sized, fills the row,
                // and shrinks proportionally only when truly out of room
                "relative z-10 flex min-w-0 flex-[1_1_auto] items-center justify-center rounded-full px-2 text-[12px] leading-none outline-none transition-[color,scale] duration-300 active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/60",
                isCurrent
                  ? "font-semibold text-white"
                  : "font-medium text-text-muted hover:text-text",
              )}
            >
              <span className="min-w-0 truncate">{s.label}</span>
            </Link>
          );
        })}
      </div>
    </>
  )}
</div>
        </div>
      </div>
    </nav>
  );
}