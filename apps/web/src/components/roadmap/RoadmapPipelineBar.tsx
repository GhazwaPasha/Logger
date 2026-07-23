"use client";

import { useMemo } from "react";
import type { GoalRow, RoadmapStatus } from "@/lib/ledger-types";
import { STATUS_LABELS, STATUS_PILL_CLASS } from "@/lib/roadmap-format";

const PIPELINE_STATUS_ORDER: RoadmapStatus[] = ["on_track", "at_risk", "done", "archived"];

const PIPELINE_BADGE_FRAME =
  "inline-flex min-w-[1.75rem] items-center justify-center rounded-sm border border-[var(--border-subtle)] px-2 py-0.5 text-xs font-semibold tabular-nums leading-none";

/** Status pipeline for goals, sized and structured after the Work board's `WorkBoardStatsCard`. */
export function RoadmapPipelineBar({ goals, loading }: { goals: GoalRow[]; loading: boolean }) {
  const counts = useMemo(() => {
    const c: Record<RoadmapStatus, number> = { on_track: 0, at_risk: 0, done: 0, archived: 0 };
    for (const g of goals) c[g.status]++;
    return c;
  }, [goals]);

  const n = (v: number) => (loading ? "…" : v);

  if (goals.length === 0 && !loading) return null;

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] lg:w-1/2"
      aria-live="polite"
      aria-label="Goal counts by status"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color-mix(in_srgb,var(--accent)_45%,transparent)] to-transparent opacity-90"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          background:
            "radial-gradient(100% 140% at 100% -20%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 48%)",
        }}
      />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 sm:px-3">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Pipeline</span>
            <span className="hidden text-[10px] text-[var(--muted)] sm:inline" aria-hidden>
              ·
            </span>
            <span className="hidden truncate text-[10px] text-[var(--muted)]/90 sm:inline">Live · all goals</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="text-xs font-medium text-[var(--muted)]">Total</span>
            <span
              className={`${PIPELINE_BADGE_FRAME} min-w-[2rem] bg-[var(--surface-muted)] px-2.5 text-sm text-[var(--fg)]`}
            >
              {n(goals.length)}
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2.5 gap-y-1.5 px-2.5 pb-1.5 pt-0 sm:px-3 sm:pb-2">
          {PIPELINE_STATUS_ORDER.map((status) => (
            <div
              key={status}
              className="group flex min-w-0 items-center gap-1.5 rounded-sm px-1 py-0.5 transition-colors hover:bg-[var(--surface-hover)]/60"
              role="group"
              aria-label={`${STATUS_LABELS[status]}: ${loading ? "loading" : counts[status]}`}
            >
              <span className="truncate text-xs font-medium text-[var(--fg)]">{STATUS_LABELS[status]}</span>
              <span className={`${PIPELINE_BADGE_FRAME} ${STATUS_PILL_CLASS[status]}`}>{n(counts[status])}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
