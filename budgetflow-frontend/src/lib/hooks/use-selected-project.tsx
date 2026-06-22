"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import type { Project } from "@/lib/domain";
import { useProjects } from "@/lib/hooks/use-budgetflow";

const storageKey = "budgetflow.selectedProjectId";

interface SelectedProjectContextValue {
  projects: Project[];
  selectedProjectId: string | null;
  setSelectedProjectId: (projectId: string) => void;
  isLoading: boolean;
}

const SelectedProjectContext =
  createContext<SelectedProjectContextValue | null>(null);

export function SelectedProjectProvider({ children }: { children: ReactNode }) {
  const projectsQuery = useProjects();
  const projects = projectsQuery.data ?? [];
  const [overrideProjectId, setOverrideProjectId] = useState<string | null>(
    null,
  );

  const selectedProjectId = (() => {
    if (projects.length === 0) return null;

    if (
      overrideProjectId &&
      projects.some((project) => project.id === overrideProjectId)
    ) {
      return overrideProjectId;
    }

    const stored =
      typeof window === "undefined"
        ? null
        : window.localStorage.getItem(storageKey);
    const isStoredValid = projects.some((project) => project.id === stored);

    return isStoredValid ? stored : projects[0].id;
  })();

  const setSelectedProjectId = (projectId: string) => {
    window.localStorage.setItem(storageKey, projectId);
    setOverrideProjectId(projectId);
  };

  return (
    <SelectedProjectContext.Provider
      value={{
        projects,
        selectedProjectId,
        setSelectedProjectId,
        isLoading: projectsQuery.isLoading,
      }}
    >
      {children}
    </SelectedProjectContext.Provider>
  );
}

export function useSelectedProject() {
  const context = useContext(SelectedProjectContext);

  if (!context) {
    throw new Error(
      "useSelectedProject must be used within a SelectedProjectProvider",
    );
  }

  return context;
}
