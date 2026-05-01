"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { OrgActivityTerminal } from "@/components/dashboard/OrgActivityTerminal";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useApiSession } from "@/hooks/useApiSession";
import { useOrgActivityFeed } from "@/hooks/useOrgActivityFeed";
import { NODE_LABELS } from "@/lib/nodes";
import { setLastWorkspaceId } from "@/lib/workspace-storage";

type DashboardView = "overview" | "activity";

export default function WorkspaceDashboardPage() {
  const { workspaceId, workspaceSlug } = useWorkspaceRoute();
  const { token } = useApiSession();
  const { depts, tasks, members, error, setError, isLoading: workspaceLoading } = useWorkspaceData();
  const [view, setView] = useState<DashboardView>("overview");

  const activityQuery = useOrgActivityFeed(token, workspaceId, view === "activity");

  useEffect(() => {
    setLastWorkspaceId(workspaceId);
  }, [workspaceId]);

  const base = `/${workspaceSlug}`;

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-8">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {NODE_LABELS.workspace} (node 1) → {NODE_LABELS.level}s (node 2) → Lists (node 3) →{" "}
            {NODE_LABELS.workItem}s (node 4).
          </p>
        </div>
        <div
          className="inline-flex shrink-0 items-center rounded-xl bg-[var(--surface-elevated)] p-0.5 shadow-sm"
          role="group"
          aria-label="Dashboard view"
        >
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)] ${
              view === "overview"
                ? "bg-[var(--accent-muted)] text-[var(--fg)]"
                : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
            }`}
            onClick={() => setView("overview")}
            aria-pressed={view === "overview"}
          >
            Overview
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)] ${
              view === "activity"
                ? "bg-[var(--accent-muted)] text-[var(--fg)]"
                : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
            }`}
            onClick={() => setView("activity")}
            aria-pressed={view === "activity"}
          >
            Activity log
          </button>
        </div>
      </div>

      {view === "overview" ? (
        <>
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
        </>
      ) : (
        <section className="surface-elevated rounded-2xl border border-[var(--border-subtle)] p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Workspace activity</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Ledger from tasks you can access, newest first (same format as task history).
          </p>
          <div className="mt-4">
            <OrgActivityTerminal
              entries={activityQuery.data?.entries ?? []}
              tasksById={activityQuery.data?.tasksById ?? {}}
              members={members}
              workHrefBase={base}
              isLoading={activityQuery.isPending}
              errorMessage={activityQuery.error ? (activityQuery.error as Error).message : null}
            />
          </div>
        </section>
      )}
    </div>
  );
}
