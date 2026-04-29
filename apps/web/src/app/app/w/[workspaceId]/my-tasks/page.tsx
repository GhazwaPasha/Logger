"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function MyTasksPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;

  useEffect(() => {
    router.replace(`/app/w/${workspaceId}/work`);
  }, [router, workspaceId]);

  return <div className="p-8 text-sm text-[var(--muted)]">Opening your tasks…</div>;
}
