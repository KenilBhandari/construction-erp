"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { useSession } from "next-auth/react";
import { signOutAction } from "./actions";
import OrangeLogo from '@/components/layout/orange-logo'

function initials(name?: string | null, email?: string | null) {
  const src = name?.trim() || email?.trim() || "?";
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export function Topbar() {
  const { data: session } = useSession();
  const user = session?.user;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape (cards and modals in this app dismiss).
  useEffect(() => {
    if (!isMenuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isMenuOpen]);

  const firstName = user?.name?.trim().split(/\s+/)[0] || "Guest";

  return (
    <header className="glass-topbar sticky top-0 z-40">
      <div className="flex h-16 w-full items-center gap-2 px-4 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center">
          <OrangeLogo />
        </div>

        {user && (
          <div className="flex shrink-0 items-center gap-4">
            {/* User Account Section */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setIsMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={isMenuOpen}
                aria-label="Account menu"
                className="flex items-center gap-3 rounded-full border border-border bg-surface py-1 pl-2.5 pr-1 transition-colors hover:bg-background"
              >
                <span className="text-right">
                  <span className="block max-w-[90px] truncate whitespace-nowrap text-xs font-bold leading-none text-text sm:max-w-[120px]">
                    Hi, {firstName}!
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 bg-primary-light text-xs font-semibold text-primary"
                >
                  {initials(user.name, user.email)}
                </span>
              </button>

              {isMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-[100] mt-2 w-56 divide-y divide-border rounded-lg border border-border bg-surface py-1 shadow-xl"
                >
                  <div className="px-4 py-3">
                    <p className="text-xs font-medium text-text-muted">
                      Signed in as
                    </p>
                    <p className="truncate text-sm font-bold text-text">
                      {user.email || "user@example.com"}
                    </p>
                  </div>

                  <div className="py-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsMenuOpen(false);
                        void signOutAction();
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-bold text-danger transition-colors hover:bg-danger/10"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
