"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { useSession } from "next-auth/react";
import { signOutAction } from "./actions";
import { activeArea, isActive, type NavItem } from "./nav-data";
import { useGlide, type GlidePill } from "./use-glide";
import { cn } from "@/lib/utils";

function initials(name?: string | null, email?: string | null) {
  const src = name?.trim() || email?.trim() || "?";
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function SubPill({ pill }: { pill: GlidePill }) {
  return (
    <span
      aria-hidden="true"
      className="glide-pill subnav-pill pointer-events-none absolute left-0 top-0 rounded-full"
      style={{
        transform: `translate(${pill.x}px, ${pill.y}px)`,
        width: pill.w,
        height: pill.h,
        opacity: pill.ready && pill.w > 0 ? 1 : 0,
        transition: pill.animate ? undefined : "none",
      }}
    />
  );
}

function SubLink({ sub, isCurrent, setRef, onTap, fill }: { sub: NavItem; isCurrent: boolean; setRef?: (el: HTMLElement | null) => void; onTap: () => void; fill?: boolean }) {
  const Icon = sub.icon;
  return (
    <Link
      ref={setRef}
      href={sub.href}
      onClick={onTap}
      aria-current={isCurrent ? "page" : undefined}
      className={cn(
        "relative z-10 flex shrink-0 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[13px] outline-none transition-transform duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/60",
        fill && "w-full",
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 transition-colors duration-200",
          isCurrent ? "text-primary" : "text-text-muted",
        )}
        strokeWidth={isCurrent ? 2.2 : 1.8}
      />
      <span
        className={cn(
          "whitespace-nowrap transition-colors duration-200",
          isCurrent ? "font-semibold text-text" : "font-medium text-text-muted",
        )}
      >
        {sub.label}
      </span>
    </Link>
  );
}

export function Topbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user;
  const area = activeArea(pathname);
  const subs = area?.children ?? [];
  const scope = area?.label ?? "home";

  // Optimistic focus: glide the instant a submodule is tapped, without
  // waiting for the route to render. Derived (not synced): once the
  // pathname moves past the tap, the route match takes over seamlessly.
  const [pressed, setPressed] = useState<{ href: string; at: string } | null>(
    null,
  );
  // Index of the tapped (optimistic) or route-matched submodule.
  const activeSubIndex = Math.max(
    0,
    subs.findIndex((s) =>
      pressed && pressed.at === pathname
        ? s.href === pressed.href
        : isActive(pathname, s.href),
    ),
  );
  const onTap = (href: string) => () =>
    setPressed({ href, at: pathname });

  // Separate glide instances per layout (CSS toggles visibility).
  const {
    containerRef: mobileBarRef,
    setItemRef: mobileItemRef,
    pill: mobilePill,
  } = useGlide(activeSubIndex, scope);
  const {
    containerRef: desktopBarRef,
    setItemRef: desktopItemRef,
    pill: desktopPill,
  } = useGlide(activeSubIndex, scope);

  return (
    <header className="glass-topbar sticky top-0 z-40">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col sm:grid sm:h-14 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-3">
          {/* Row wrapper: one row on mobile, dissolved into the grid on desktop */}
          <div className="flex h-14 items-center gap-2 sm:contents">
            <div className="min-w-0 flex-1 sm:col-start-1 sm:row-start-1">
              <p className="truncate text-[15px] font-semibold text-text">
                Construction ERP
              </p>
              <p className="hidden truncate text-xs text-text-muted sm:block">
                Labour &amp; project management
              </p>
            </div>

            {user && (
              <div className="flex shrink-0 items-center gap-2 sm:col-start-3 sm:row-start-1 sm:justify-self-end sm:gap-2.5">
                <div className="hidden text-right sm:block">
                  <p className="max-w-40 truncate text-sm font-medium text-text">
                    {user.name}
                  </p>
                  <p className="max-w-40 truncate text-xs text-text-muted">
                    {user.email}
                  </p>
                </div>
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 bg-primary-light text-xs font-semibold text-primary"
                >
                  {initials(user.name, user.email)}
                </span>
                <form action={signOutAction} className="flex">
                  <button
                    type="submit"
                    aria-label="Sign out"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white/60 text-text outline-none transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-primary/60 sm:h-auto sm:w-auto sm:px-3 sm:py-1.5 sm:text-sm"
                  >
                    <LogOut className="h-4 w-4 sm:hidden" />
                    <span className="hidden sm:inline">Sign out</span>
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Contextual subnav: full-width labeled chips on mobile,
              centered trough on desktop. Shared pill glides in both. */}
          {subs.length > 0 && (
            <nav
              aria-label={`${area?.label} sections`}
              className="pb-3 sm:col-start-2 sm:row-start-1 sm:justify-self-center sm:pb-0"
            >
              {/* Mobile: roomy equal chips */}
              <div
                ref={mobileBarRef}
                className="subnav-trough relative flex items-center gap-0.5 rounded-full p-1 sm:hidden"
              >
                <SubPill pill={mobilePill} />
                {subs.map((sub, i) => (
                  <div key={sub.href} ref={mobileItemRef(i)} className="flex min-w-0 flex-1">
                    <SubLink
                      sub={sub}
                      isCurrent={i === activeSubIndex}
                      onTap={onTap(sub.href)}
                      fill
                    />
                  </div>
                ))}
              </div>

              {/* Desktop: compact centered trough */}
              <div
                ref={desktopBarRef}
                className="subnav-trough relative hidden items-center gap-0.5 rounded-full p-1 sm:flex"
              >
                <SubPill pill={desktopPill} />
                {subs.map((sub, i) => (
                  <SubLink
                    key={sub.href}
                    sub={sub}
                    isCurrent={i === activeSubIndex}
                    setRef={desktopItemRef(i)}
                    onTap={onTap(sub.href)}
                  />
                ))}
              </div>
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
