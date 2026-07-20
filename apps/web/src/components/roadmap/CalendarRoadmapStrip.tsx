"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useApiSession } from "@/hooks/useApiSession";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { useRoadmap } from "@/hooks/useRoadmap";
import { PERIOD_BADGE_CLASS, PERIOD_LABELS, STATUS_DOT_CLASS, STATUS_LABELS } from "@/lib/roadmap-format";
import type { RoadmapPeriod } from "@/lib/ledger-types";

const PERIOD_PRIORITY: Record<RoadmapPeriod, number> = { yearly: 3, quarterly: 2, monthly: 1, weekly: 0 };

/** Compact strip of goals whose date range overlaps the visible calendar month. */
export function CalendarRoadmapStrip({ year, month }: { year: number; month: number }) {
  const { token } = useApiSession();
  const { workspaceId, workspaceSlug } = useWorkspaceRoute();
  const roadmap = useRoadmap(token, workspaceId);

  const monthStart = Date.UTC(year, month, 1);
  const monthEnd = Date.UTC(year, month + 1, 1);

  const overlapping = useMemo(() => {
    const items = roadmap.items.filter((i) => {
      const start = new Date(i.periodStart).getTime();
      const end = new Date(i.periodEnd).getTime();
      return start < monthEnd && end >= monthStart && i.status !== "archived";
    });
    items.sort((a, b) => PERIOD_PRIORITY[a.period] - PERIOD_PRIORITY[b.period] || a.periodStart.localeCompare(b.periodStart));
    return items;
  }, [roadmap.items, monthStart, monthEnd]);

  if (overlapping.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-[var(--muted)]">Roadmap this month:</span>
      {overlapping.map((g) => (
        <Link
          key={g.id}
          href={`/${workspaceSlug}/roadmap`}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-2.5 py-1 text-xs font-medium text-[var(--fg)] transition-colors hover:border-[var(--accent)]"
          title={`${g.title} — ${STATUS_LABELS[g.status]}, ${g.progress.pct}% done`}
        >
          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${PERIOD_BADGE_CLASS[g.period]}`}>
            {PERIOD_LABELS[g.period]}
          </span>
          <span className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT_CLASS[g.status]}`} aria-hidden />
          <span className="max-w-[10rem] truncate">{g.title}</span>
          <span className="shrink-0 tabular-nums text-[var(--muted)]">{g.progress.pct}%</span>
        </Link>
      ))}
    </div>
  );
}
