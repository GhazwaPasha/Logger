"use client";

import { useParams } from "next/navigation";
import { AddWorkspacePanel } from "@/components/app/AddWorkspacePanel";

export default function AddWorkspacePage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  return <AddWorkspacePanel variant="inWorkspace" contextWorkspaceId={workspaceId} />;
}
