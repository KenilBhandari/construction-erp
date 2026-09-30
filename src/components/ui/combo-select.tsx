
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Cross-instance coordination: opening one menu closes all others. */
export const COMBO_OPEN_EVENT = "combo-select:open";

export interface ComboOption {
  value: string;
  label: string;
}

type MenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

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
  autoOpen?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [pos, setPos] = useState<MenuPosition | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  /*
   * Ghost-tap guard (phones): selecting an option commits on pointerdown and
   * unmounts the menu, but touch browsers still deliver the tap's `click`
   * afterwards — landing on whatever is now under the finger (e.g. a card
   * below the menu) and triggering it too. Stamping every close lets a
   * capture-phase listener below swallow just that orphaned click.
   */
  const lastCloseAt = useRef(0);

  const instanceId = useId();

  const selected = options.find((o) => o.value === value);

  const listId = `combo-${(ariaLabel ?? label ?? "select")
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase()}`;

  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  function selectedIndex() {
    const idx = options.findIndex((o) => o.value === value);
    return idx >= 0 ? idx : 0;
  }

  /**
   * Position the portaled menu relative to the trigger.
   *
   * Important:
   * - Coordinates are viewport coordinates because the menu is fixed.
   * - Width is based on the trigger.
   * - The menu is never allowed to go outside the viewport.
   * - Available vertical space is calculated from the trigger.
   */
  function measure(): MenuPosition | null {
    const button = btnRef.current;

    if (!button || typeof window === "undefined") {
      return null;
    }

    const r = button.getBoundingClientRect();

    if (
      r.width <= 0 ||
      r.height <= 0 ||
      r.bottom < 0 ||
      r.top > window.innerHeight
    ) {
      return null;
    }

    const viewportPadding = 8;
    const gap = 4;

    const availableBelow =
      window.innerHeight - r.bottom - viewportPadding;

    const availableAbove =
      r.top - viewportPadding;

    /*
     * Keep mobile menus compact while still allowing desktop menus
     * to show more items.
     */
    const preferredHeight =
      window.innerWidth < 640 ? 220 : 256;

    const shouldOpenBelow =
      availableBelow >= Math.min(preferredHeight, availableBelow) ||
      availableBelow >= availableAbove;

    const availableHeight = Math.max(
      80,
      shouldOpenBelow ? availableBelow : availableAbove,
    );

    const maxMenuHeight = Math.min(
      preferredHeight,
      availableHeight,
    );

    /*
     * Keep the menu at least as wide as the trigger.
     * On mobile, don't make it unnecessarily wide.
     */
    const minWidth = Math.max(
      r.width,
      window.innerWidth < 640 ? 140 : 160,
    );

    const maxWidth = Math.min(
      320,
      window.innerWidth - viewportPadding * 2,
    );

    const width = Math.min(
      Math.max(minWidth, r.width),
      maxWidth,
    );

    let left = r.left;

    // Keep the entire dropdown inside the viewport.
    if (left + width > window.innerWidth - viewportPadding) {
      left = window.innerWidth - width - viewportPadding;
    }

    left = Math.max(viewportPadding, left);

    const top = shouldOpenBelow
      ? r.bottom + gap
      : Math.max(
          viewportPadding,
          r.top - maxMenuHeight - gap,
        );

    return {
      top,
      left,
      width,
      maxHeight: maxMenuHeight,
    };
  }

  function openList() {
    const p = measure();

    if (!p) {
      return;
    }

    setPos(p);
    setHighlight(selectedIndex());
    setOpen(true);

    window.dispatchEvent(
      new CustomEvent(COMBO_OPEN_EVENT, {
        detail: instanceId,
      }),
    );
  }

  function closeList() {
    setOpen(false);
    setHighlight(-1);
    setPos(null);
    lastCloseAt.current = Date.now();
    onCloseRef.current?.();
  }

  function toggleList() {
    if (disabled) return;

    if (open) {
      closeList();
    } else {
      openList();
    }
  }

  function pick(idx: number) {
    const opt = options[idx];

    if (!opt) return;

    onChange(opt.value);
    closeList();
  }

  /*
   * Auto-open is used by the attendance editor.
   */
  useEffect(() => {
    if (!autoOpen) return;

    const frame = requestAnimationFrame(() => {
      openList();
    });

    return () => cancelAnimationFrame(frame);

    // Intentionally only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * Outside click.
   *
   * Because the menu is portaled to document.body, it is NOT inside
   * wrapRef. Therefore we explicitly check listRef too.
   */
  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;

      const clickedTrigger =
        !!wrapRef.current?.contains(target);

      const clickedMenu =
        !!listRef.current?.contains(target);

      if (!clickedTrigger && !clickedMenu) {
        closeList();
      }
    }

    document.addEventListener(
      "pointerdown",
      onPointerDown,
      true,
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        onPointerDown,
        true,
      );
    };
  }, [open]);

  /*
   * Swallow the orphaned click that follows a menu close on touch devices.
   * Capture phase runs before React's root-delegated handlers (cards, links),
   * so stopping it here keeps the tap from activating what slid under the
   * finger. Trigger taps are exempt so reopening still works; desktop is
   * unaffected — pointerdown-preventDefault there means no click ever arrives
   * inside the window.
   */
  useEffect(() => {
    function onClickCapture(e: MouseEvent) {
      if (Date.now() - lastCloseAt.current > 350) return;
      const target = e.target as Node | null;
      if (!target) return;
      if (wrapRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      e.stopPropagation();
      e.preventDefault();
    }

    document.addEventListener("click", onClickCapture, true);

    return () => {
      document.removeEventListener("click", onClickCapture, true);
    };
  }, []);

  /*
   * When another ComboSelect opens, close this one.
   */
  useEffect(() => {
    function onPeerOpen(e: Event) {
      const otherId = (e as CustomEvent<string>).detail;

      if (otherId !== instanceId && open) {
        closeList();
      }
    }

    window.addEventListener(
      COMBO_OPEN_EVENT,
      onPeerOpen,
    );

    return () => {
      window.removeEventListener(
        COMBO_OPEN_EVENT,
        onPeerOpen,
      );
    };
  }, [instanceId, open]);

  /*
   * Keep the fixed menu attached to the trigger while the table,
   * page, modal, or another scroll container moves.
   */
  useEffect(() => {
    if (!open) return;

    let raf = 0;

    const reposition = () => {
      cancelAnimationFrame(raf);

      raf = requestAnimationFrame(() => {
        const p = measure();

        if (!p) {
          closeList();
          return;
        }

        setPos(p);
      });
    };

    const onScroll = () => {
      reposition();
    };

    const onResize = () => {
      reposition();
    };

    window.addEventListener(
      "scroll",
      onScroll,
      true,
    );

    window.addEventListener(
      "resize",
      onResize,
    );

    /*
     * visualViewport matters on phones when the browser URL bar
     * expands/collapses or the keyboard changes the viewport.
     */
    window.visualViewport?.addEventListener(
      "resize",
      onResize,
    );

    window.visualViewport?.addEventListener(
      "scroll",
      onScroll,
    );

    return () => {
      cancelAnimationFrame(raf);

      window.removeEventListener(
        "scroll",
        onScroll,
        true,
      );

      window.removeEventListener(
        "resize",
        onResize,
      );

      window.visualViewport?.removeEventListener(
        "resize",
        onResize,
      );

      window.visualViewport?.removeEventListener(
        "scroll",
        onScroll,
      );
    };
  }, [open]);

  /*
   * Keep highlighted option visible.
   */
  useEffect(() => {
    if (!open || highlight < 0) return;

    listRef.current
      ?.querySelector<HTMLElement>(
        `[data-idx="${highlight}"]`,
      )
      ?.scrollIntoView({
        block: "nearest",
      });
  }, [open, highlight]);

  return (
    <div
      ref={wrapRef}
      className={cn(
        "flex min-w-0 flex-col gap-1",
        className,
      )}
    >
      {label && (
        <span className="text-sm font-medium text-text">
          {label}
          {required && (
            <span className="text-danger"> *</span>
          )}
        </span>
      )}

      <div className="relative min-w-0">
        <button
          ref={btnRef}
          type="button"
          disabled={disabled}
          aria-label={ariaLabel ?? label}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onClick={toggleList}
          onKeyDown={(e) => {
            if (
              !open &&
              (
                e.key === "ArrowDown" ||
                e.key === "ArrowUp" ||
                e.key === "Enter" ||
                e.key === " "
              )
            ) {
              e.preventDefault();
              openList();
              return;
            }

            if (e.key === "ArrowDown") {
              e.preventDefault();

              setHighlight((h) =>
                Math.min(
                  h + 1,
                  options.length - 1,
                ),
              );
            } else if (e.key === "ArrowUp") {
              e.preventDefault();

              setHighlight((h) =>
                Math.max(h - 1, 0),
              );
            } else if (
              e.key === "Enter" ||
              e.key === " "
            ) {
              e.preventDefault();

              if (open) {
                pick(highlight);
              }
            } else if (e.key === "Escape") {
              e.preventDefault();
              closeList();
            }
          }}
          className={cn(
            /*
             * Compact by default.
             *
             * Your existing triggerClassName can still override this.
             */
            "flex h-9 w-full min-w-0 items-center justify-between gap-2",
            "rounded-md border border-border bg-surface",
            "pl-2.5 pr-2 text-sm text-text text-left",
            "focus:border-primary focus:outline-none",
            "focus:ring-1 focus:ring-primary/25",
            "sm:h-10 sm:pl-3 sm:pr-2.5 sm:text-sm",
            triggerClassName,
            open &&
              "border-primary ring-1 ring-primary/25",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          <span className="min-w-0 flex-1 truncate">
            {selected?.label ?? "Select…"}
          </span>

          <ChevronDown
            aria-hidden="true"
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-text-muted",
              "transition-transform duration-150",
              open && "rotate-180",
            )}
          />
        </button>

        {error && (
          <p className="text-xs text-danger">
            {error}
          </p>
        )}

        {open &&
          pos &&
          typeof document !== "undefined" &&
          createPortal(
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={ariaLabel ?? label}
              style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                width: pos.width,
                maxHeight: pos.maxHeight,
                zIndex: 9999,
              }}
              className={cn(
                "scroll-area overflow-x-hidden overflow-y-auto",
                "rounded-md border border-border",
                "bg-surface py-1 shadow-xl",
              )}
            >
              {options.map((option, idx) => {
                const isSelected =
                  option.value === value;

                return (
                  <li
                    key={option.value}
                    data-idx={idx}
                    role="option"
                    aria-selected={isSelected}
                    onPointerDown={(e) => {
                      /*
                       * Prevent the trigger from losing focus / the
                       * document handler from closing the menu before
                       * pick() runs.
                       */
                      e.preventDefault();
                      pick(idx);
                    }}
                    onMouseEnter={() =>
                      setHighlight(idx)
                    }
                    className={cn(
                      /*
                       * Compact rows on phone.
                       */
                      "flex min-h-9 cursor-pointer",
                      "items-center justify-between",
                      "gap-2 px-2.5 text-sm",
                      "sm:min-h-9 sm:px-3",
                      idx === highlight
                        ? "bg-primary/10 text-primary"
                        : "text-text",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {option.label}
                    </span>

                    {isSelected && (
                      <Check
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0"
                      />
                    )}
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
