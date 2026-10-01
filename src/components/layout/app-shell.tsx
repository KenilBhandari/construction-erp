"use client";

import type { ReactNode } from "react";
import { SidebarNav } from "./sidebar";
import { Topbar } from "./topbar";
import { BottomDock } from "./bottom-dock";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Topbar />
      <div className="flex min-w-0 flex-1">
        {/* Desktop sidebar (md and up, below topbar) */}
        <aside className="hidden w-60 shrink-0 border-r border-border bg-surface md:block">
          <div className="sticky top-16 flex h-[calc(100vh-4rem)] flex-col overflow-y-auto">
            <SidebarNav />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <main className="mx-auto w-full max-w-6xl flex-1 min-w-0 px-4 pb-32 pt-4 sm:px-6 sm:pt-6 md:pb-6">
            {children}
          </main>
          {/* Phone dock (below md) */}
          <BottomDock />
        </div>
      </div>
    </div>
  );
}
