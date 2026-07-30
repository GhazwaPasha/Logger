"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApiSession } from "@/hooks/useApiSession";
import { useOrganizationsState } from "@/components/app/OrganizationsProvider";
import { AppHeader } from "@/components/app/AppHeader";
import { AppEntryAccountSidebar } from "@/components/app/AppEntryAccountSidebar";
import { AddWorkspacePanel } from "@/components/app/AddWorkspacePanel";
import { workspaceUrlSegment } from "@/lib/workspace-url";
import { getLastWorkspaceId, setLastWorkspaceId } from "@/lib/workspace-storage";
import { useBoot } from "@/components/app/BootProvider";

export default function AppEntryPage() {
  const router = useRouter();
  const { token, isPending } = useApiSession();
  const { orgs, isLoading: orgsLoading } = useOrganizationsState();
  const { deactivate } = useBoot();

  useEffect(() => {
    if (isPending || !token || orgsLoading) return;
    if (orgs.length === 0) {
      deactivate();
      return;
    }
    const lastWorkspaceId = getLastWorkspaceId();
    const target = orgs.find((o) => o.id === lastWorkspaceId) ?? orgs[0];
    setLastWorkspaceId(target.id);
    router.replace(`/${workspaceUrlSegment(target)}/dashboard`);
  }, [isPending, token, orgsLoading, orgs, router, deactivate]);

  if (isPending || !token || orgsLoading || orgs.length > 0) return null;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--surface-base)]">
      <AppHeader />
      <div className="flex min-h-0 w-full flex-1 flex-col md:flex-row md:items-stretch">
        <AppEntryAccountSidebar />
        <main className="min-h-0 min-w-0 flex-1 overflow-auto px-3 pb-6 pt-3 sm:px-4 lg:px-5 sm:pt-4">
          <AddWorkspacePanel variant="standalone" />
        </main>
      </div>
    </div>
  );
}
