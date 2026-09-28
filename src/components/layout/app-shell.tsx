"use client";

import type { ReactNode } from "react";
import { Topbar } from "./topbar";
import { BottomDock } from "./bottom-dock";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Topbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-32 pt-6 sm:px-6">
        {children}
      </main>
      <BottomDock />
    </div>
  );
}
