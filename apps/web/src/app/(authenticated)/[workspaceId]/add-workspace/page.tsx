"use client";

import { AddWorkspacePanel } from "@/components/app/AddWorkspacePanel";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";

export default function AddWorkspacePage() {
  const { workspaceId } = useWorkspaceRoute();

  return <AddWorkspacePanel variant="inWorkspace" contextWorkspaceId={workspaceId} />;
}
