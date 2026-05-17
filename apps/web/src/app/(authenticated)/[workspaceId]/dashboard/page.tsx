"use client";

import { useEffect, useState } from "react";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { ExportButton } from "@/components/dashboard/ExportButton";
import { OrgActivityTerminal } from "@/components/dashboard/OrgActivityTerminal";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useApiSession } from "@/hooks/useApiSession";
import { useOrgActivityFeed } from "@/hooks/useOrgActivityFeed";
import { NODE_LABELS } from "@/lib/nodes";
import { setLastWorkspaceId } from "@/lib/workspace-storage";

type DashboardView = "overview" | "activity";

export default function WorkspaceDashboardPage() {
  const { workspaceId, workspaceSlug } = useWorkspaceRoute();
  const { token, session } = useApiSession();
  const { depts, tasks, members, lists, error, setError, isLoading: workspaceLoading } = useWorkspaceData();
  const [view, setView] = useState<DashboardView>("overview");

  const activityQuery = useOrgActivityFeed(token, workspaceId, view === "activity");

  useEffect(() => {
    setLastWorkspaceId(workspaceId);
  }, [workspaceId]);

  const base = `/${workspaceSlug}`;

  return (
    <div className="mx-auto w-full max-w-[min(100%,104rem)] space-y-3">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-[var(--muted)]">
            Track workload, deadlines, and ownership across your {NODE_LABELS.workspace.toLowerCase()}. Use{" "}
            <span className="text-[var(--fg)]">Activity log</span> for the full ledger.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ExportButton />
        <div
          className="inline-flex shrink-0 items-center rounded-xl bg-[var(--surface-elevated)] p-0.5"
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
      </div>

      {view === "overview" ? (
        <DashboardOverview
          basePath={base}
          depts={depts}
          lists={lists}
          tasks={tasks}
          members={members}
          workspaceLoading={workspaceLoading}
          currentUserId={session?.user?.id ?? null}
        />
      ) : (
        <section className="surface-elevated rounded-2xl border border-[var(--border-subtle)] p-3.5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Workspace activity</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            Ledger from tasks you can access, newest first (same format as task history).
          </p>
          <div className="mt-2">
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
