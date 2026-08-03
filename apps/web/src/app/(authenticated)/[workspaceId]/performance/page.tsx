"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { ExportButton } from "@/components/dashboard/ExportButton";
import { PerformanceKpiRow } from "@/components/performance/PerformanceKpiRow";
import { TeamScorecardTable } from "@/components/performance/TeamScorecardTable";
import { MemberChipRow } from "@/components/performance/MemberChipRow";
import { MemberDetailPanel } from "@/components/performance/MemberDetailPanel";
import { PerformanceActivityFeed } from "@/components/performance/PerformanceActivityFeed";
import { DateRangePresets, presetToRange, type DateRangePreset } from "@/components/performance/DateRangePresets";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { LoadingFrame } from "@/components/ui/LoadingFrame";
import { useApiSession } from "@/hooks/useApiSession";
import { usePerformanceScorecards } from "@/hooks/usePerformanceScorecards";
import { useOrgActivityFeed } from "@/hooks/useOrgActivityFeed";
import { canViewPerformance } from "@/lib/workspace-permissions";
import { setLastWorkspaceId } from "@/lib/workspace-storage";

export default function WorkspacePerformancePage() {
  const { workspaceId, workspaceSlug } = useWorkspaceRoute();
  const { token, session } = useApiSession();
  const { members, error, setError, isLoading: workspaceLoading } = useWorkspaceData();
  const [rangeDays, setRangeDays] = useState<DateRangePreset>(30);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    setLastWorkspaceId(workspaceId);
  }, [workspaceId]);

  const base = `/${workspaceSlug}`;
  const userId = session?.user?.id ?? null;
  const allowed = canViewPerformance(members, userId);
  // Stable across renders until rangeDays changes — presetToRange() calls `new Date()`, so
  // recomputing it inline on every render would change the query key every time and loop forever.
  const range = useMemo(() => presetToRange(rangeDays), [rangeDays]);

  const scorecardsQuery = usePerformanceScorecards(token, workspaceId, allowed, range);
  const activityQuery = useOrgActivityFeed(token, workspaceId, allowed);

  const scorecardMembers = scorecardsQuery.data?.members ?? [];
  // Defaults to the top-ranked member so the detail panel isn't empty on first load.
  const selectedMember = scorecardMembers.find((m) => m.userId === selectedUserId) ?? scorecardMembers[0] ?? null;

  if (!workspaceLoading && !allowed) {
    return (
      <div className="mx-auto w-full max-w-[min(100%,60rem)]">
        <div className="surface-elevated ui-elevated-panel rounded-2xl border border-[var(--border-subtle)] p-5 text-center">
          <p className="text-sm font-medium text-[var(--fg)]">Performance is restricted</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Only workspace owners and managers can view team performance and compliance data.
          </p>
          <Link href={`${base}/dashboard`} className="btn-primary mt-6 inline-flex rounded-xl px-5">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const loading = workspaceLoading || scorecardsQuery.isPending;

  return (
    <div className="mx-auto w-full max-w-[min(100%,104rem)] space-y-3">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Performance</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-[var(--muted)]">
            Who did what, when, and how compliant it was — across the team.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ExportButton types={["performance"]} />
          <DateRangePresets value={rangeDays} onChange={setRangeDays} />
        </div>
      </div>

      {scorecardsQuery.error ? (
        <ErrorBanner
          message={scorecardsQuery.error instanceof Error ? scorecardsQuery.error.message : "Could not load performance data"}
        />
      ) : null}

      <LoadingFrame show={loading} className="rounded-2xl p-0.5" ribbonRadius="2xl" aria-label="Loading performance data">
        <div className="space-y-2">
          <PerformanceKpiRow totals={scorecardsQuery.data?.totals} loading={loading} />

          <div className="surface-elevated ui-elevated-panel rounded-2xl border border-[var(--border-subtle)] p-2.5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Team scorecard</h2>
            <p className="mt-0.5 text-sm text-[var(--muted)]">Completion, on-time rate, workload, and time logged per person</p>
            <TeamScorecardTable members={scorecardMembers} loading={loading} />
          </div>

          <div className="surface-elevated ui-elevated-panel rounded-2xl border border-[var(--border-subtle)] p-2.5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Team members</h2>
            <p className="mt-0.5 text-sm text-[var(--muted)]">Pick a person for their full breakdown and tasks</p>
            <div className="mt-2">
              <MemberChipRow members={scorecardMembers} selectedUserId={selectedMember?.userId ?? null} onSelect={setSelectedUserId} />
            </div>
            <MemberDetailPanel
              member={selectedMember}
              token={token}
              organizationId={workspaceId}
              range={range}
              workHrefBase={base}
            />
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Activity</h2>
            <p className="mt-0.5 text-sm text-[var(--muted)]">Everyone&rsquo;s activity, newest first — filter down to one person</p>
            <div className="mt-2">
              <PerformanceActivityFeed
                activity={activityQuery.data}
                members={members}
                workHrefBase={base}
                isLoading={activityQuery.isPending}
                errorMessage={activityQuery.error ? (activityQuery.error as Error).message : null}
              />
            </div>
          </div>
        </div>
      </LoadingFrame>
    </div>
  );
}
