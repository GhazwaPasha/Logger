"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useApiSession } from "@/hooks/useApiSession";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { useRoadmap } from "@/hooks/useRoadmap";
import { RoadmapStatsRow } from "@/components/roadmap/RoadmapStatsRow";
import { STATUS_DOT_CLASS, STATUS_LABELS } from "@/lib/roadmap-format";

export function RoadmapDashboardPanel({ basePath }: { basePath: string }) {
  const { token } = useApiSession();
  const { workspaceId } = useWorkspaceRoute();
  const roadmap = useRoadmap(token, workspaceId);
  const goalTitleById = useMemo(() => new Map(roadmap.goals.map((g) => [g.id, g.title] as const)), [roadmap.goals]);

  const activeMilestones = useMemo(() => {
    const now = new Date().getTime();
    const active = roadmap.milestones.filter((m) => {
      const start = new Date(m.periodStart).getTime();
      const end = new Date(m.periodEnd).getTime();
      return start <= now && now <= end && m.status !== "archived";
    });
    active.sort((a, b) => a.periodEnd.localeCompare(b.periodEnd) || b.progress.pct - a.progress.pct);
    return active.slice(0, 5);
  }, [roadmap.milestones]);

  if (roadmap.milestones.length === 0) return null;

  return (
    <div className="space-y-3">
      <RoadmapStatsRow goals={roadmap.goals} milestones={roadmap.milestones} loading={roadmap.isLoading} />

      <div className="surface-elevated ui-elevated-panel rounded-2xl border border-[var(--border-subtle)] p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Roadmap</h2>
            <p className="mt-0.5 text-sm text-[var(--muted)]">Milestones active right now</p>
          </div>
          <Link href={`${basePath}/roadmap`} className="shrink-0 text-xs font-medium text-[var(--accent)] hover:underline">
            Open Roadmap
          </Link>
        </div>

        {activeMilestones.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">No milestones cover today&apos;s date.</p>
        ) : (
          <ul className="mt-2.5 space-y-2.5">
            {activeMilestones.map((m) => (
              <li key={m.id}>
                <Link href={`${basePath}/roadmap`} className="block">
                  <div className="flex items-center gap-2 text-sm">
                    {goalTitleById.get(m.goalId) && (
                      <span className="max-w-[6rem] shrink-0 truncate rounded-full bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
                        {goalTitleById.get(m.goalId)}
                      </span>
                    )}
                    <span
                      className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT_CLASS[m.status]}`}
                      title={STATUS_LABELS[m.status]}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate font-medium text-[var(--fg)]">{m.title}</span>
                    <span className="shrink-0 tabular-nums text-[var(--muted)]">{m.progress.pct}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                    <div className="h-full rounded-full bg-[var(--accent)]/70" style={{ width: `${m.progress.pct}%` }} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
