"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/** Deep links land here; tasks are edited in the modal on the work board. */
export default function WorkTaskDeepLinkPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;
  const taskId = params.taskId as string;

  useEffect(() => {
    router.replace(`/app/w/${workspaceId}/work?task=${encodeURIComponent(taskId)}`);
  }, [router, workspaceId, taskId]);

  return <div className="p-8 text-sm text-[var(--muted)]">Opening task…</div>;
}
