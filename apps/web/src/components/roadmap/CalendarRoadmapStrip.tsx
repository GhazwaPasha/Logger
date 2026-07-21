"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useApiSession } from "@/hooks/useApiSession";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { useRoadmap } from "@/hooks/useRoadmap";
import { STATUS_DOT_CLASS, STATUS_LABELS } from "@/lib/roadmap-format";

/** Compact strip of milestones whose date range overlaps the visible calendar month. */
export function CalendarRoadmapStrip({ year, month }: { year: number; month: number }) {
  const { token } = useApiSession();
  const { workspaceId, workspaceSlug } = useWorkspaceRoute();
  const roadmap = useRoadmap(token, workspaceId);

  const monthStart = Date.UTC(year, month, 1);
  const monthEnd = Date.UTC(year, month + 1, 1);
  const goalTitleById = useMemo(() => new Map(roadmap.goals.map((g) => [g.id, g.title] as const)), [roadmap.goals]);

  const overlapping = useMemo(() => {
    const items = roadmap.milestones.filter((m) => {
      const start = new Date(m.periodStart).getTime();
      const end = new Date(m.periodEnd).getTime();
      return start < monthEnd && end >= monthStart && m.status !== "archived";
    });
    items.sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
    return items;
  }, [roadmap.milestones, monthStart, monthEnd]);

  if (overlapping.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-[var(--muted)]">Roadmap this month:</span>
      {overlapping.map((m) => (
        <Link
          key={m.id}
          href={`/${workspaceSlug}/roadmap`}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-2.5 py-1 text-xs font-medium text-[var(--fg)] transition-colors hover:border-[var(--accent)]"
          title={`${m.title} — ${STATUS_LABELS[m.status]}, ${m.progress.pct}% done`}
        >
          {goalTitleById.get(m.goalId) && (
            <span className="max-w-[6rem] shrink-0 truncate rounded-full bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
              {goalTitleById.get(m.goalId)}
            </span>
          )}
          <span className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT_CLASS[m.status]}`} aria-hidden />
          <span className="max-w-[10rem] truncate">{m.title}</span>
          <span className="shrink-0 tabular-nums text-[var(--muted)]">{m.progress.pct}%</span>
        </Link>
      ))}
    </div>
  );
}
