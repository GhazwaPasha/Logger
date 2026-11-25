"use client";

import { useEffect, useState } from "react";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { DashboardOverview, Seq, useDashboardStats } from "@/components/dashboard/DashboardOverview";
import { useClosedTaskCounts } from "@/hooks/useWorkTaskStats";
import { OrgActivityTerminal } from "@/components/dashboard/OrgActivityTerminal";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Segmented } from "@/components/ui/Segmented";
import { useApiSession } from "@/hooks/useApiSession";
import { useActivityFeedPages } from "@/hooks/useOrgActivityFeed";
import { setLastWorkspaceId } from "@/lib/workspace-storage";
import { ChartPieIcon, TerminalIcon } from "lucide-react";

type DashboardView = "overview" | "activity";

const VIEWS = [
  { value: "overview", label: "Overview", icon: ChartPieIcon },
  // A terminal, because that's where it takes you: the workspace's activity log.
  { value: "activity", label: "Activity log", icon: TerminalIcon },
] as const;

function partOfDay(d = new Date()) {
  const h = d.getHours();
  return h < 5 ? "Up late" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function WorkspaceDashboardPage() {
  const { workspaceId, workspaceSlug, timeZone } = useWorkspaceRoute();
  const { token, session } = useApiSession();
  const { depts, tasks, members, lists, error, setError, isLoading: workspaceLoading } = useWorkspaceData();
  const [view, setView] = useState<DashboardView>("overview");
  const currentUserId = session?.user?.id ?? null;
  const closed = useClosedTaskCounts(token, workspaceId);
  const stats = useDashboardStats(tasks, depts, lists, currentUserId, timeZone, closed.counts);

  const activityQuery = useActivityFeedPages(token, workspaceId, view === "activity");

  useEffect(() => {
    setLastWorkspaceId(workspaceId);
  }, [workspaceId]);

  const base = `/${workspaceSlug}`;
  const firstName = session?.user?.name?.trim().split(/\s+/)[0] || "there";

  return (
    <div className="mx-auto w-full max-w-[min(100%,104rem)] space-y-4">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <Seq index={0} className="flex items-center gap-3">
        <h1 className="page-title min-w-0 flex-1 truncate">
          {partOfDay()}, {firstName}
        </h1>
        <Segmented
          value={view}
          onChange={setView}
          aria-label="Dashboard view"
          options={VIEWS.map((v) => ({
            value: v.value,
            label: v.label,
            icon: <v.icon className="size-4" />,
          }))}
        />
      </Seq>

      {view === "overview" ? (
        <DashboardOverview
          basePath={base}
          stats={stats}
          depts={depts}
          lists={lists}
          members={members}
          loading={workspaceLoading || closed.isLoading}
          currentUserId={currentUserId}
        />
      ) : (
        <OrgActivityTerminal
          entries={activityQuery.data?.entries ?? []}
          tasksById={activityQuery.data?.tasksById ?? {}}
          members={members}
          workHrefBase={base}
          isLoading={activityQuery.isPending}
          errorMessage={activityQuery.error ? (activityQuery.error as Error).message : null}
          maxHeightClassName="max-h-[min(72vh,40rem)]"
          hasMore={activityQuery.hasMore}
          loadingMore={activityQuery.loadingMore}
          onLoadMore={activityQuery.loadMore}
        />
      )}
    </div>
  );
}
