"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

export interface GlidePill {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Positioned on a real item → safe to show. */
  ready: boolean;
  /** False for first placement / scope change / resize, so the pill snaps. */
  animate: boolean;
}

/**
 * @param activeIndex index of the active item, or -1 for none (pill hides)
 * @param scope       changes when the item set changes; the pill snaps instead of gliding
 */
export function useGlide(activeIndex: number, scope: string = "") {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const scopeRef = useRef(scope);
  const [pill, setPill] = useState<GlidePill>({
    x: 0, y: 0, w: 0, h: 0, ready: false, animate: false,
  });

  const measure = useCallback(
    (snap = false) => {
      const container = containerRef.current;
      if (!container) return;
      const el = activeIndex >= 0 ? itemRefs.current[activeIndex] : null;

      if (!el) {
        // Nothing active: hide, and re-enter by snapping (not gliding from a stale spot).
        setPill((p) => (p.ready ? { ...p, ready: false, animate: false } : p));
        return;
      }

      const scopeChanged = scopeRef.current !== scope;
      scopeRef.current = scope;
      const c = container.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      setPill((prev) => ({
        x: r.left - c.left + container.scrollLeft,
        y: r.top - c.top,
        w: r.width,
        h: r.height,
        ready: true,
        animate: prev.ready && !scopeChanged && !snap,
      }));
    },
    [activeIndex, scope],
  );

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useLayoutEffect(() => {
    const remeasure = () => measure(true);
    window.addEventListener("resize", remeasure);
    if (document.fonts) void document.fonts.ready.then(remeasure);
    return () => window.removeEventListener("resize", remeasure);
  }, [measure]);

  const setItemRef = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      itemRefs.current[index] = el;
    },
    [],
  );

  return { containerRef, setItemRef, pill };
}