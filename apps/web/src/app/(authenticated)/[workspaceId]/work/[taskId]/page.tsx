"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";

/** Deep links land here; tasks are edited in the modal on the work board. */
export default function WorkTaskDeepLinkPage() {
  const params = useParams();
  const router = useRouter();
  const { workspaceSlug } = useWorkspaceRoute();
  const taskId = params.taskId as string;

  useEffect(() => {
    router.replace(`/${workspaceSlug}/work?task=${encodeURIComponent(taskId)}`);
  }, [router, workspaceSlug, taskId]);

  return <div className="p-8 text-sm text-[var(--muted)]">Opening task…</div>;
}
