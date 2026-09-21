"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface ProjectContextValue {
  selectedProjectId: string | null;
  selectedSiteId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  setSelectedSiteId: (id: string | null) => void;
}

const ProjectContext = createContext<ProjectContextValue>({
  selectedProjectId: null,
  selectedSiteId: null,
  setSelectedProjectId: () => {},
  setSelectedSiteId: () => {},
});

const PROJECT_KEY = "erp.selectedProject";
const SITE_KEY = "erp.selectedSite";

export function ProjectProvider({ children }: { children: ReactNode }) {
  // Lazy init from localStorage (remember recent project/site, §50).
  // Guard for SSR where window is undefined.
  const [selectedProjectId, setProject] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(PROJECT_KEY);
    } catch {
      return null;
    }
  });
  const [selectedSiteId, setSite] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(SITE_KEY);
    } catch {
      return null;
    }
  });

  const setSelectedProjectId = useCallback((id: string | null) => {
    setProject(id);
    // Changing project clears site selection.
    setSite(null);
    try {
      if (id) localStorage.setItem(PROJECT_KEY, id);
      else localStorage.removeItem(PROJECT_KEY);
      localStorage.removeItem(SITE_KEY);
    } catch {
      // Ignore persistence errors.
    }
  }, []);

  const setSelectedSiteId = useCallback((id: string | null) => {
    setSite(id);
    try {
      if (id) localStorage.setItem(SITE_KEY, id);
      else localStorage.removeItem(SITE_KEY);
    } catch {
      // Ignore persistence errors.
    }
  }, []);

  const value = useMemo(
    () => ({
      selectedProjectId,
      selectedSiteId,
      setSelectedProjectId,
      setSelectedSiteId,
    }),
    [selectedProjectId, selectedSiteId, setSelectedProjectId, setSelectedSiteId],
  );

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}

export function useProject() {
  return useContext(ProjectContext);
}
