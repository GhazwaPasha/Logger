"use client";

import { useMemo, useState } from "react";
import { CaretLeft, CaretRight, Flag, PencilSimple } from "@phosphor-icons/react";
import { STATUS_BAR_CLASS, STATUS_LABELS } from "@/lib/roadmap-format";
import type { GoalRow, MilestoneRow } from "@/lib/ledger-types";

const DAY_MS = 24 * 60 * 60 * 1000;

type TimelineRow = { milestone: MilestoneRow; depth: number };

function flattenVisible(
  roots: MilestoneRow[],
  childrenByParent: Map<string, MilestoneRow[]>,
  expanded: Set<string>,
  depth: number,
  out: TimelineRow[],
) {
  for (const milestone of roots
    .slice()
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart) || a.orderIndex - b.orderIndex)) {
    out.push({ milestone, depth });
    if (expanded.has(milestone.id)) {
      flattenVisible(childrenByParent.get(milestone.id) ?? [], childrenByParent, expanded, depth + 1, out);
    }
  }
}

/** Month-start gridline ticks between start/end, spaced 1/2/3 months apart depending on span. */
function buildTicks(axisStart: number, axisEnd: number): { pos: number; label: string }[] {
  const spanDays = (axisEnd - axisStart) / DAY_MS;
  const stepMonths = spanDays <= 100 ? 1 : spanDays <= 260 ? 2 : 3;
  const startDate = new Date(axisStart);
  let cursor = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1);
  if (cursor < axisStart) cursor = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 1);
  const ticks: { pos: number; label: string }[] = [];
  let lastYear: number | null = null;
  while (cursor < axisEnd) {
    const d = new Date(cursor);
    const year = d.getUTCFullYear();
    const label =
      lastYear !== year
        ? d.toLocaleDateString(undefined, { month: "short", year: "numeric" })
        : d.toLocaleDateString(undefined, { month: "short" });
    lastYear = year;
    ticks.push({ pos: ((cursor - axisStart) / (axisEnd - axisStart)) * 100, label });
    cursor = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + stepMonths, 1);
  }
  return ticks;
}

export function RoadmapTimelineView({
  goals,
  rootMilestonesByGoal,
  childrenByParent,
  expanded,
  loading,
  onToggle,
  onEditMilestone,
}: {
  goals: GoalRow[];
  rootMilestonesByGoal: Map<string, MilestoneRow[]>;
  childrenByParent: Map<string, MilestoneRow[]>;
  expanded: Set<string>;
  loading: boolean;
  onToggle: (id: string) => void;
  onEditMilestone: (milestone: MilestoneRow) => void;
}) {
  /** Manual shift, in units of the current window's span — 0 is the natural (data-driven) window. */
  const [shift, setShift] = useState(0);

  const visibleByGoal = useMemo(() => {
    const m = new Map<string, TimelineRow[]>();
    for (const goal of goals) {
      const flat: TimelineRow[] = [];
      flattenVisible(rootMilestonesByGoal.get(goal.id) ?? [], childrenByParent, expanded, 0, flat);
      m.set(goal.id, flat);
    }
    return m;
  }, [goals, rootMilestonesByGoal, childrenByParent, expanded]);

  /** Data-driven window: the union span of everything visible, padded ~6% each side. Falls back to a year around today when empty. */
  const naturalRange = useMemo(() => {
    let min: number | null = null;
    let max: number | null = null;
    for (const rows of visibleByGoal.values()) {
      for (const { milestone } of rows) {
        const start = new Date(milestone.periodStart).getTime();
        const end = new Date(milestone.periodEnd).getTime();
        if (min === null || start < min) min = start;
        if (max === null || end > max) max = end;
      }
    }
    if (min === null || max === null) {
      const now = new Date().getTime();
      return { start: now - 60 * DAY_MS, end: now + 305 * DAY_MS };
    }
    const pad = Math.max((max - min) * 0.06, 3 * DAY_MS);
    return { start: min - pad, end: max + pad };
  }, [visibleByGoal]);

  const axisSpan = naturalRange.end - naturalRange.start;
  const axisStart = naturalRange.start + shift * axisSpan;
  const axisEnd = naturalRange.end + shift * axisSpan;

  const ticks = useMemo(() => buildTicks(axisStart, axisEnd), [axisStart, axisEnd]);

  const todayPct = useMemo(() => {
    const now = new Date().getTime();
    if (now < axisStart || now >= axisEnd) return null;
    return ((now - axisStart) / axisSpan) * 100;
  }, [axisStart, axisEnd, axisSpan]);

  const rowsByGoal = useMemo(() => {
    const m = new Map<string, TimelineRow[]>();
    for (const goal of goals) {
      const rows = (visibleByGoal.get(goal.id) ?? []).filter(({ milestone }) => {
        const start = new Date(milestone.periodStart).getTime();
        const end = new Date(milestone.periodEnd).getTime();
        return end >= axisStart && start < axisEnd;
      });
      if (rows.length > 0) m.set(goal.id, rows);
    }
    return m;
  }, [goals, visibleByGoal, axisStart, axisEnd]);

  return (
    <div className="surface-elevated ui-elevated-panel rounded-2xl border border-[var(--border-subtle)] p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-lg p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
            onClick={() => setShift((s) => s - 1)}
            aria-label="Earlier"
          >
            <CaretLeft weight="bold" className="size-4" />
          </button>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)] disabled:opacity-40"
            onClick={() => setShift(0)}
            disabled={shift === 0}
          >
            Reset
          </button>
          <button
            type="button"
            className="rounded-lg p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
            onClick={() => setShift((s) => s + 1)}
            aria-label="Later"
          >
            <CaretRight weight="bold" className="size-4" />
          </button>
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
          {(Object.keys(STATUS_LABELS) as (keyof typeof STATUS_LABELS)[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${STATUS_BAR_CLASS[s]}`} aria-hidden />
              {STATUS_LABELS[s]}
            </span>
          ))}
        </div>
      </div>

      {rowsByGoal.size === 0 && !loading ? (
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-[var(--accent-muted)] text-[var(--accent)]" aria-hidden>
            <Flag size={24} weight="bold" />
          </span>
          <div>
            <p className="text-sm font-medium text-[var(--fg)]">No milestones in view</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Try Reset, or add a milestone from the outline view.</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            {/* Month gridline header — mirrors the row layout (toggle + track + % + edit columns) so gridlines line up with the bars below */}
            <div className="mb-1.5 flex items-center gap-2">
              <span className="size-5 shrink-0" aria-hidden />
              <div className="relative h-5 flex-1 border-b border-[var(--border-subtle)]">
                {ticks.map((t) => (
                  <span
                    key={t.pos}
                    className="absolute top-0 text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]"
                    style={{ left: `${t.pos}%` }}
                  >
                    {t.label}
                  </span>
                ))}
              </div>
              <span className="w-9 shrink-0" aria-hidden />
              <span className="size-6 shrink-0" aria-hidden />
            </div>

            <div className="space-y-3">
              {goals.map((goal) => {
                const rows = rowsByGoal.get(goal.id);
                if (!rows) return null;
                return (
                  <div key={goal.id}>
                    <p className="mb-1 truncate text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      {goal.title}
                    </p>
                    <div className="space-y-1.5">
                      {rows.map(({ milestone, depth }) => {
                        const start = new Date(milestone.periodStart).getTime();
                        const end = new Date(milestone.periodEnd).getTime();
                        const left = Math.max(0, ((start - axisStart) / axisSpan) * 100);
                        const right = Math.min(100, ((end - axisStart) / axisSpan) * 100);
                        const width = Math.max(1.5, right - left);
                        const hasChildren = (childrenByParent.get(milestone.id)?.length ?? 0) > 0;
                        const isOpen = expanded.has(milestone.id);
                        return (
                          <div key={milestone.id} className="group flex items-center gap-2">
                            <button
                              type="button"
                              className="flex size-5 shrink-0 items-center justify-center text-[var(--muted)]"
                              onClick={() => hasChildren && onToggle(milestone.id)}
                              aria-label={hasChildren ? (isOpen ? "Collapse" : "Expand") : undefined}
                            >
                              {hasChildren ? (
                                <CaretRight
                                  weight="bold"
                                  className={`size-3.5 transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
                                />
                              ) : null}
                            </button>
                            <div className="relative h-8 flex-1 rounded-md bg-[var(--surface-muted)]">
                              {todayPct != null && (
                                <div
                                  className="absolute top-0 h-full w-px bg-[var(--accent)]"
                                  style={{ left: `${todayPct}%` }}
                                  aria-hidden
                                />
                              )}
                              <button
                                type="button"
                                className={`absolute top-1 flex h-6 items-center overflow-hidden rounded-md px-2 shadow-sm ${STATUS_BAR_CLASS[milestone.status]} transition-opacity hover:opacity-90`}
                                style={{ left: `${left}%`, width: `${width}%`, paddingLeft: `${8 + depth * 10}px` }}
                                onClick={() => onEditMilestone(milestone)}
                                title={`${goal.title} › ${milestone.title} — ${milestone.progress.pct}% done`}
                                aria-label={`Edit ${milestone.title}, ${milestone.progress.pct}% done`}
                              >
                                <span className="truncate text-[11px] font-semibold text-white drop-shadow-sm">
                                  {milestone.title}
                                </span>
                              </button>
                            </div>
                            <span className="w-9 shrink-0 text-right text-xs tabular-nums text-[var(--muted)]">
                              {milestone.progress.pct}%
                            </span>
                            <button
                              type="button"
                              className="flex size-6 shrink-0 items-center justify-center rounded-md text-[var(--muted)] opacity-0 transition-opacity hover:bg-[var(--surface-hover)] hover:text-[var(--fg)] group-hover:opacity-100"
                              onClick={() => onEditMilestone(milestone)}
                              aria-label={`Edit ${milestone.title}`}
                              title="Edit"
                            >
                              <PencilSimple size={14} weight="bold" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
