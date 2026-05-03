"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { AppHeader } from "./AppHeader";
import { WorkspaceSidebar } from "./WorkspaceSidebar";
import { WorkspaceRouteContext } from "./workspace-route-context";
import { WorkspaceDataProvider } from "@/components/app/WorkspaceDataProvider";
import { WorkspaceNotificationsProvider } from "@/components/notifications/WorkspaceNotificationsProvider";
import { useOrganizationsState } from "@/components/app/OrganizationsProvider";
import { useApiSession } from "@/hooks/useApiSession";
import type { Org } from "@/lib/ledger-types";
import { pathAfterWorkspace, resolveOrgFromUrlSegment, workspaceUrlSegment } from "@/lib/workspace-url";

export function WorkspaceShell({
  workspaceSegment,
  children,
}: {
  /** Raw first path segment (workspace slug or legacy org id). */
  workspaceSegment: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { token } = useApiSession();
  const { orgs, isLoading: orgsLoading } = useOrganizationsState();

  const resolved = useMemo((): Org | undefined => {
    if (orgsLoading || orgs.length === 0) return undefined;
    return resolveOrgFromUrlSegment(orgs, workspaceSegment);
  }, [orgs, orgsLoading, workspaceSegment]);

  useEffect(() => {
    if (!token || orgsLoading) return;
    if (orgs.length === 0) {
      router.replace("/app");
      return;
    }
    if (!resolved) {
      router.replace("/app");
      return;
    }
    if (workspaceSegment === resolved.id && resolved.slug) {
      const tail = pathAfterWorkspace(pathname);
      const q = searchParams.toString();
      const suffix = q ? `?${q}` : "";
      router.replace(`/${resolved.slug}${tail}${suffix}`);
    }
  }, [token, orgsLoading, orgs.length, resolved, workspaceSegment, pathname, searchParams, router]);

  if (!token || orgsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface-base)]">
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      </div>
    );
  }

  if (!resolved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface-base)]">
        <p className="text-sm text-[var(--muted)]">Redirecting…</p>
      </div>
    );
  }

  const workspaceId = resolved.id;
  const workspaceSlug = workspaceUrlSegment(resolved);

  return (
    <WorkspaceRouteContext.Provider value={{ workspaceId, workspaceSlug }}>
      <WorkspaceDataProvider workspaceId={workspaceId}>
        <WorkspaceNotificationsProvider>
          <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[var(--surface-base)]">
            <AppHeader workspaceSlug={workspaceSlug} />
            <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden md:flex-row md:items-stretch">
              <WorkspaceSidebar workspaceId={workspaceId} workspaceSlug={workspaceSlug} />
              <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6 pt-3 sm:px-4 lg:px-5 sm:pt-4">
                {children}
              </main>
            </div>
          </div>
        </WorkspaceNotificationsProvider>
      </WorkspaceDataProvider>
    </WorkspaceRouteContext.Provider>
  );
}
