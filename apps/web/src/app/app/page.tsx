"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApiSession } from "@/hooks/useApiSession";
import { useOrganizationsState } from "@/components/app/OrganizationsProvider";
import { getLastWorkspaceId } from "@/lib/workspace-storage";

export default function AppEntryPage() {
  const router = useRouter();
  const { token, isPending } = useApiSession();
  const { orgs } = useOrganizationsState();

  useEffect(() => {
    if (isPending || !token) return;
    const last = getLastWorkspaceId();
    if (last && orgs.some((o) => o.id === last)) {
      router.replace(`/app/w/${last}/overview`);
      return;
    }
    router.replace("/app/workspaces");
  }, [isPending, token, orgs, router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <p className="text-sm text-[var(--muted)]">Opening app…</p>
    </div>
  );
}
