"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { ProjectProvider } from "@/context/ProjectContext";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ProjectProvider>{children}</ProjectProvider>
    </SessionProvider>
  );
}
