"use client";

import { createContext, useContext } from "react";

export type WorkspaceRouteValue = { workspaceId: string; workspaceSlug: string; timeZone: string };

/** DOM id of the shell's slot between page content and the Ask pane, for docked detail panes. */
export const WORKSPACE_DETAIL_SLOT_ID = "workspace-detail-slot";

export const WorkspaceRouteContext = createContext<WorkspaceRouteValue | null>(null);

export function useWorkspaceRoute(): WorkspaceRouteValue {
  const ctx = useContext(WorkspaceRouteContext);
  if (!ctx) {
    throw new Error("useWorkspaceRoute must be used within a workspace layout");
  }
  return ctx;
}
