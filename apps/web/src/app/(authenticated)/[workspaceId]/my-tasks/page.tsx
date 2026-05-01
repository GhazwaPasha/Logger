"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";

export default function MyTasksPage() {
  const router = useRouter();
  const { workspaceSlug } = useWorkspaceRoute();

  useEffect(() => {
    router.replace(`/${workspaceSlug}/work`);
  }, [router, workspaceSlug]);

  return <div className="p-8 text-sm text-[var(--muted)]">Opening your tasks…</div>;
}
