"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useApiSession } from "@/hooks/useApiSession";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { useRoadmap } from "@/hooks/useRoadmap";
import { PERIOD_BADGE_CLASS, PERIOD_LABELS, STATUS_DOT_CLASS, STATUS_LABELS } from "@/lib/roadmap-format";
import type { RoadmapItemRow, RoadmapPeriod } from "@/lib/ledger-types";

/** Most-specific-first — a live weekly goal is more actionable to surface than its parent quarter. */
const PERIOD_PRIORITY: Record<RoadmapPeriod, number> = { weekly: 0, monthly: 1, quarterly: 2, yearly: 3 };

export function RoadmapDashboardPanel({ basePath }: { basePath: string }) {
  const { token } = useApiSession();
  const { workspaceId } = useWorkspaceRoute();
  const roadmap = useRoadmap(token, workspaceId);

  const activeGoals = useMemo(() => {
    const now = new Date().getTime();
    const active = roadmap.items.filter((i) => {
      const start = new Date(i.periodStart).getTime();
      const end = new Date(i.periodEnd).getTime();
      return start <= now && now <= end && i.status !== "archived";
    });
    active.sort((a, b) => PERIOD_PRIORITY[a.period] - PERIOD_PRIORITY[b.period] || b.progress.pct - a.progress.pct);
    return active.slice(0, 5);
  }, [roadmap.items]);

  if (roadmap.items.length === 0) return null;

  return (
    <div className="surface-elevated ui-elevated-panel rounded-2xl border border-[var(--border-subtle)] p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Roadmap</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">Goals active right now</p>
        </div>
        <Link href={`${basePath}/roadmap`} className="shrink-0 text-xs font-medium text-[var(--accent)] hover:underline">
          Open Roadmap
        </Link>
      </div>

      {activeGoals.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">No goals cover today&apos;s date.</p>
      ) : (
        <ul className="mt-2.5 space-y-2.5">
          {activeGoals.map((g: RoadmapItemRow) => (
            <li key={g.id}>
              <Link href={`${basePath}/roadmap`} className="block">
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PERIOD_BADGE_CLASS[g.period]}`}
                  >
                    {PERIOD_LABELS[g.period]}
                  </span>
                  <span
                    className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT_CLASS[g.status]}`}
                    title={STATUS_LABELS[g.status]}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate font-medium text-[var(--fg)]">{g.title}</span>
                  <span className="shrink-0 tabular-nums text-[var(--muted)]">{g.progress.pct}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                  <div className="h-full rounded-full bg-[var(--accent)]/70" style={{ width: `${g.progress.pct}%` }} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
