"use client";

import type { ReactNode } from "react";
import { SidebarNav } from "./sidebar";
import { Topbar } from "./topbar";
import { BottomDock } from "./bottom-dock";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar (md and up) */}
      <aside className="hidden w-60 shrink-0 border-r border-border bg-surface md:block">
        <div className="sticky top-0 flex h-screen flex-col overflow-y-auto">
          <div className="border-b border-border px-5 py-4">
            <p className="text-sm font-semibold text-text">Construction ERP</p>
            <p className="text-xs text-text-muted">Site &amp; labour manager</p>
          </div>
          <SidebarNav />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="mx-auto w-full max-w-6xl flex-1 min-w-0 px-4 pb-32 pt-4 sm:px-6 sm:pt-6 md:pb-6">
          {children}
        </main>
        {/* Phone dock (below md) */}
        <BottomDock />
      </div>
    </div>
  );
}
