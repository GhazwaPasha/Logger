"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppHeader } from "./AppHeader";
import { WorkspaceSidebar } from "./WorkspaceSidebar";
import { useApiSession } from "@/hooks/useApiSession";
import { useOrganizationsState } from "@/components/app/OrganizationsProvider";
import { WorkspaceDataProvider } from "@/components/app/WorkspaceDataProvider";

export function WorkspaceShell({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { token } = useApiSession();
  const { orgs } = useOrganizationsState();

  useEffect(() => {
    if (!token || orgs.length === 0) return;
    if (!orgs.some((o) => o.id === workspaceId)) {
      router.replace(`/app/w/${orgs[0].id}/dashboard`);
    }
  }, [token, orgs, workspaceId, router]);

  return (
    <WorkspaceDataProvider workspaceId={workspaceId}>
      <div className="flex min-h-screen flex-col bg-[var(--surface-base)]">
        <AppHeader workspaceId={workspaceId} />
        <div className="flex min-h-0 w-full flex-1 flex-col md:flex-row md:items-stretch">
          <WorkspaceSidebar workspaceId={workspaceId} />
          <main className="min-h-0 min-w-0 flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </WorkspaceDataProvider>
  );
}
