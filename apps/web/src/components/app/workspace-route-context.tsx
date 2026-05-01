"use client";

import { createContext, useContext } from "react";

export type WorkspaceRouteValue = { workspaceId: string; workspaceSlug: string };

export const WorkspaceRouteContext = createContext<WorkspaceRouteValue | null>(null);

export function useWorkspaceRoute(): WorkspaceRouteValue {
  const ctx = useContext(WorkspaceRouteContext);
  if (!ctx) {
    throw new Error("useWorkspaceRoute must be used within a workspace layout");
  }
  return ctx;
}
