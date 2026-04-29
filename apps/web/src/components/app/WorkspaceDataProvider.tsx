"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useApiSession } from "@/hooks/useApiSession";
import { useOrgWorkspace } from "@/hooks/useOrgWorkspace";

type WorkspaceDataState = ReturnType<typeof useOrgWorkspace>;

const WorkspaceDataContext = createContext<WorkspaceDataState | null>(null);

export function WorkspaceDataProvider({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: ReactNode;
}) {
  const { token } = useApiSession();
  const value = useOrgWorkspace(token, workspaceId);
  return <WorkspaceDataContext.Provider value={value}>{children}</WorkspaceDataContext.Provider>;
}

export function useWorkspaceData(): WorkspaceDataState {
  const ctx = useContext(WorkspaceDataContext);
  if (!ctx) {
    throw new Error("useWorkspaceData must be used within WorkspaceDataProvider");
  }
  return ctx;
}
