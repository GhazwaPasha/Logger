"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppHeader } from "./AppHeader";
import { WorkspaceSidebar } from "./WorkspaceSidebar";
import { WorkspaceRouteContext } from "./workspace-route-context";
import { WorkspaceDataProvider } from "@/components/app/WorkspaceDataProvider";
import { WorkspaceRealtimeSubscriber } from "@/components/app/WorkspaceRealtimeSubscriber";
import { WorkspaceNotificationsProvider } from "@/components/notifications/WorkspaceNotificationsProvider";
import { KeyboardShortcutsProvider } from "@/components/app/KeyboardShortcutsProvider";
import { OnlinePresenceProvider } from "@/components/app/OnlinePresenceProvider";
import { useOrganizationsState } from "@/components/app/OrganizationsProvider";
import { AppBootScreen } from "@/components/ui/LoadingFrame";
import { useApiSession } from "@/hooks/useApiSession";
import { useBoot } from "@/components/app/BootProvider";
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
  const { deactivate } = useBoot();

  const resolved = useMemo((): Org | undefined => {
    if (orgsLoading || orgs.length === 0) return undefined;
    return resolveOrgFromUrlSegment(orgs, workspaceSegment);
  }, [orgs, orgsLoading, workspaceSegment]);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), []);

  useEffect(() => {
    if (!token || orgsLoading) return;
    deactivate();
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
  }, [token, orgsLoading, orgs.length, resolved, workspaceSegment, pathname, searchParams, router, deactivate]);

  if (!token || orgsLoading) {
    return <AppBootScreen />;
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
      <OnlinePresenceProvider>
      <WorkspaceDataProvider workspaceId={workspaceId}>
        <WorkspaceRealtimeSubscriber workspaceId={workspaceId} />
        <WorkspaceNotificationsProvider>
        <KeyboardShortcutsProvider>
          <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[var(--surface-base)]">
            <AppHeader workspaceSlug={workspaceSlug} onMenuToggle={() => setMobileSidebarOpen((v) => !v)} />
            <div className="flex min-h-0 w-full flex-1 overflow-hidden md:flex-row md:items-stretch">
              <WorkspaceSidebar
                workspaceId={workspaceId}
                workspaceSlug={workspaceSlug}
                mobileOpen={mobileSidebarOpen}
                onMobileClose={closeMobileSidebar}
              />
              <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain scrollbar-hide px-3 pb-6 pt-3 sm:px-4 lg:px-5 sm:pt-4">
                {children}
              </main>
            </div>
          </div>
        </KeyboardShortcutsProvider>
        </WorkspaceNotificationsProvider>
      </WorkspaceDataProvider>
      </OnlinePresenceProvider>
    </WorkspaceRouteContext.Provider>
  );
}
