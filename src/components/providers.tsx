"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { ProjectProvider } from "@/context/ProjectContext";
import { CacheProvider } from "@/context/CacheContext";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ProjectProvider>
        <CacheProvider>{children}</CacheProvider>
      </ProjectProvider>
    </SessionProvider>
  );
}
