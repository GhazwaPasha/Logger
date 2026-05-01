"use client";

import { useParams } from "next/navigation";
import { WorkspaceShell } from "@/components/app/WorkspaceShell";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const workspaceSegment = params.workspaceId as string;
  return <WorkspaceShell workspaceSegment={workspaceSegment}>{children}</WorkspaceShell>;
}
