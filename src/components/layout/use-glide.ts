"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

export interface GlidePill {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Positioned at least once → safe to show. */
  ready: boolean;
  /** False for the first placement / a scope change, so the pill snaps instead of sliding in. */
  animate: boolean;
}

/**
 * Measures the active item inside a relative container and positions one
 * shared pill over it. The `.glide-pill` CSS transition does the motion.
 *
 * @param activeIndex index of the active item
 * @param scope       changes when the item set changes (e.g. the active module),
 *                    so the pill snaps to place instead of gliding from stale coords
 */
export function useGlide(activeIndex: number, scope: string = "") {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const scopeRef = useRef(scope);
  const [pill, setPill] = useState<GlidePill>({
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    ready: false,
    animate: false,
  });

  const measure = useCallback(() => {
    const container = containerRef.current;
    const el = itemRefs.current[activeIndex];
    if (!container || !el) return;
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
      animate: prev.ready && !scopeChanged,
    }));
  }, [activeIndex, scope]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useLayoutEffect(() => {
    window.addEventListener("resize", measure);
    if (document.fonts) {
      void document.fonts.ready.then(() => measure());
    }
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const setItemRef = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      itemRefs.current[index] = el;
    },
    [],
  );

  return { containerRef, setItemRef, pill };
}