"use client";

import { useSession } from "next-auth/react";
import { signOutAction } from "./actions";

function initials(name?: string | null, email?: string | null) {
  const src = name?.trim() || email?.trim() || "?";
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export function Topbar() {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-40 border-b border-white/50 bg-white/60 backdrop-blur-2xl backdrop-saturate-150 [box-shadow:inset_0_1px_0_rgba(255,255,255,0.9)]">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text">
            Construction ERP
          </p>
          <p className="truncate text-xs text-text-muted">
            Labour &amp; project management
          </p>
        </div>

        {user && (
          <div className="flex shrink-0 items-center gap-2.5">
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
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-full border border-border bg-white/60 px-3 py-1.5 text-sm text-text transition-colors hover:bg-white"
              >
                Sign out
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
