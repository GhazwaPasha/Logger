"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { NODE_LABELS } from "@/lib/nodes";
import { setLastWorkspaceId } from "@/lib/workspace-storage";

export default function WorkspaceDashboardPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const { depts, tasks, members, error, setError, isLoading: workspaceLoading } = useWorkspaceData();

  useEffect(() => {
    setLastWorkspaceId(workspaceId);
  }, [workspaceId]);

  const base = `/app/w/${workspaceId}`;

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-8">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {NODE_LABELS.workspace} (node 1) → {NODE_LABELS.level}s (node 2) → Lists (node 3) → {NODE_LABELS.workItem}s (node 4).
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="surface-elevated rounded-2xl border border-[var(--border-subtle)] p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{NODE_LABELS.level}s</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {workspaceLoading ? "…" : depts.length}
          </p>
        </div>
        <div className="surface-elevated rounded-2xl border border-[var(--border-subtle)] p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Open tasks</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {workspaceLoading ? "…" : tasks.filter((t) => !t.deletedAt).length}
          </p>
        </div>
        <div className="surface-elevated rounded-2xl border border-[var(--border-subtle)] p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Team members</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {workspaceLoading ? "…" : members.length}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href={`${base}/work`} className="btn-primary rounded-xl px-5">
          Open tasks
        </Link>
        <Link href={`${base}/work`} className="btn-secondary rounded-xl px-5">
          Task checklist
        </Link>
        <Link href={`${base}/people`} className="btn-secondary rounded-xl px-5">
          Team
        </Link>
      </div>
    </div>
  );
}
