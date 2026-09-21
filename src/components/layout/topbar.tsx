"use client";

import { Menu } from "lucide-react";
import { useSession } from "next-auth/react";
import { signOutAction } from "./actions";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-surface px-4">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open navigation"
        className="rounded-md p-2 text-text hover:bg-background lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text">
          Construction ERP
        </p>
        <p className="truncate text-xs text-text-muted">
          Labour &amp; project management
        </p>
      </div>

      {user && (
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="max-w-40 truncate text-sm font-medium text-text">
              {user.name}
            </p>
            <p className="max-w-40 truncate text-xs text-text-muted">
              {user.email}
            </p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-md border border-border px-3 py-1.5 text-sm text-text hover:bg-background"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </header>
  );
}
