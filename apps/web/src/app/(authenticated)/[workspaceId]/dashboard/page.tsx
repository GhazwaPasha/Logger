"use client";

import { faChartPie, faTerminal } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { DashboardOverview, Seq, useDashboardStats } from "@/components/dashboard/DashboardOverview";
import { OrgActivityTerminal } from "@/components/dashboard/OrgActivityTerminal";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useApiSession } from "@/hooks/useApiSession";
import { useActivityFeedPages } from "@/hooks/useOrgActivityFeed";
import { setLastWorkspaceId } from "@/lib/workspace-storage";

type DashboardView = "overview" | "activity";

const VIEWS = [
  { value: "overview", label: "Overview", icon: faChartPie },
  // A terminal, because that's where it takes you: the workspace's activity log.
  { value: "activity", label: "Activity log", icon: faTerminal },
] as const;

/** How often the greeting's fact line rotates. */
const FACT_MS = 9000;

function partOfDay(d = new Date()) {
  const h = d.getHours();
  return h < 5 ? "Up late" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** "Good afternoon, Ghazwa", with a line underneath that rotates through what's worth knowing right now. */
function Greeting({ name, facts, loading }: { name: string; facts: (string | null)[]; loading: boolean }) {
  const reduced = useReducedMotion();
  const lines = facts.filter((f): f is string => !!f);
  const shown = loading ? ["Catching up on your workspace…"] : lines.length ? lines : ["All caught up — nice work"];
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (shown.length < 2) return;
    const t = window.setInterval(() => setTick((n) => n + 1), FACT_MS);
    return () => window.clearInterval(t);
  }, [shown.length]);

  const fact = shown[tick % shown.length];
  return (
    <div className="min-w-0 flex-1">
      <h1 className="font-outfit truncate text-2xl font-bold tracking-tight">
        {partOfDay()}, {name}
      </h1>
      <div className="relative mt-0.5 h-5 overflow-hidden" aria-live="polite">
        <AnimatePresence initial={false}>
          <motion.p
            key={fact}
            className="absolute inset-x-0 top-0 truncate text-sm text-[var(--muted)]"
            initial={reduced ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.32 } }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -14, transition: { duration: 0.22 } }}
          >
            {fact}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function WorkspaceDashboardPage() {
  const { workspaceId, workspaceSlug, timeZone } = useWorkspaceRoute();
  const { token, session } = useApiSession();
  const { depts, tasks, members, lists, error, setError, isLoading: workspaceLoading } = useWorkspaceData();
  const [view, setView] = useState<DashboardView>("overview");
  const currentUserId = session?.user?.id ?? null;
  const stats = useDashboardStats(tasks, depts, lists, currentUserId, timeZone);

  const activityQuery = useActivityFeedPages(token, workspaceId, view === "activity");

  useEffect(() => {
    setLastWorkspaceId(workspaceId);
  }, [workspaceId]);

  const base = `/${workspaceSlug}`;
  const firstName = session?.user?.name?.trim().split(/\s+/)[0] || "there";
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  return (
    <div className="mx-auto w-full max-w-[min(100%,104rem)] space-y-4">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <Seq index={0} className="flex items-center gap-3">
        <Greeting
          name={firstName}
          loading={workspaceLoading}
          facts={[
            stats.overdue > 0 ? `${plural(stats.overdue, "task is", "tasks are")} overdue` : null,
            stats.workflow.in_progress > 0 ? `${stats.workflow.in_progress} in progress right now` : null,
            stats.dueThisWeek > 0 ? `${stats.dueThisWeek} due this week` : null,
            stats.unassigned > 0 ? `${stats.unassigned} waiting for an owner` : null,
            stats.mine > 0 ? `${stats.mine} assigned to you` : null,
            stats.workflow.pending > 0 ? `${stats.workflow.pending} pending in the queue` : null,
          ]}
        />
        <div
          className="inline-flex h-11 shrink-0 items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-1.5"
          role="tablist"
          aria-label="Dashboard view"
        >
          {VIEWS.map((v) => {
            const active = view === v.value;
            return (
              <button
                key={v.value}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={v.label}
                title={v.label}
                onClick={() => setView(v.value)}
                className={`flex h-8 w-[3.25rem] items-center justify-center rounded-full transition-[background-color,color,transform] duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                  active
                    ? "bg-[var(--accent)] text-[var(--on-accent)]"
                    : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
                }`}
              >
                <FontAwesomeIcon icon={v.icon} className="size-3.5" aria-hidden />
              </button>
            );
          })}
        </div>
      </Seq>

      {view === "overview" ? (
        <DashboardOverview
          basePath={base}
          stats={stats}
          depts={depts}
          lists={lists}
          members={members}
          loading={workspaceLoading}
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
