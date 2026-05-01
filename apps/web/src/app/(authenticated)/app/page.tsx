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

export default function AppEntryPage() {
  const router = useRouter();
  const { token, isPending } = useApiSession();
  const { orgs, isLoading: orgsLoading } = useOrganizationsState();

  useEffect(() => {
    if (isPending || !token) return;
    if (orgs.length === 0) return;
    const lastWorkspaceId = getLastWorkspaceId();
    const target = orgs.find((o) => o.id === lastWorkspaceId) ?? orgs[0];
    setLastWorkspaceId(target.id);
    router.replace(`/${workspaceUrlSegment(target)}/dashboard`);
  }, [isPending, token, orgs, router]);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--surface-base)]">
      <AppHeader />
      {orgsLoading ? (
        <div className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-6 text-center">
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          </div>
        </div>
      ) : orgs.length > 0 ? (
        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-6 text-center">
            <p className="text-sm text-[var(--muted)]">Opening your workspace…</p>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 w-full flex-1 flex-col md:flex-row md:items-stretch">
          <AppEntryAccountSidebar />
          <main className="min-h-0 min-w-0 flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-8">
            <AddWorkspacePanel variant="standalone" />
          </main>
        </div>
      )}
    </div>
  );
}
