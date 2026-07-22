"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowsIn, ArrowsOut, CaretLeft, CaretRight, Flag, PencilSimple } from "@phosphor-icons/react";
import { STATUS_BAR_CLASS, STATUS_LABELS, milestoneDepthStyle } from "@/lib/roadmap-format";
import type { GoalRow, MilestoneRow } from "@/lib/ledger-types";

const DAY_MS = 24 * 60 * 60 * 1000;

type TimelineRow = { milestone: MilestoneRow; depth: number };
type DisplayRow =
  | { kind: "goal"; goal: GoalRow }
  | { kind: "milestone"; goal: GoalRow; milestone: MilestoneRow; depth: number };

/** Every descendant, unconditionally — used only for the shared axis date range, never for what's actually rendered. */
function flattenAll(roots: MilestoneRow[], childrenByParent: Map<string, MilestoneRow[]>, depth: number, out: TimelineRow[]) {
  for (const milestone of roots
    .slice()
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart) || a.orderIndex - b.orderIndex)) {
    out.push({ milestone, depth });
    flattenAll(childrenByParent.get(milestone.id) ?? [], childrenByParent, depth + 1, out);
  }
}

/** Roots always show (once the goal's master toggle is open); a milestone's own children only show once its own bar-toggle is expanded. */
function flattenExpanded(
  roots: MilestoneRow[],
  childrenByParent: Map<string, MilestoneRow[]>,
  expandedMilestones: Set<string>,
  depth: number,
  out: TimelineRow[],
) {
  for (const milestone of roots
    .slice()
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart) || a.orderIndex - b.orderIndex)) {
    out.push({ milestone, depth });
    if (expandedMilestones.has(milestone.id)) {
      flattenExpanded(childrenByParent.get(milestone.id) ?? [], childrenByParent, expandedMilestones, depth + 1, out);
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

/**
 * Every goal on one shared axis. Two tiers of expand/collapse: one master toggle per goal
 * (shows/hides its whole tree) and, once shown, each individual milestone bar that has
 * children carries its own small toggle for just that branch.
 */
export function RoadmapGrandView({
  goals,
  rootMilestonesByGoal,
  childrenByParent,
  loading,
  onEditGoal,
  onEditMilestone,
}: {
  goals: GoalRow[];
  rootMilestonesByGoal: Map<string, MilestoneRow[]>;
  childrenByParent: Map<string, MilestoneRow[]>;
  loading: boolean;
  onEditGoal: (goal: GoalRow) => void;
  onEditMilestone: (milestone: MilestoneRow) => void;
}) {
  /** Manual shift, in units of the current window's span — 0 is the natural (data-driven) window. */
  const [shift, setShift] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(() => new Set());
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!focusMode) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFocusMode(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [focusMode]);

  function toggleGoal(goalId: string) {
    setExpandedGoals((prev) => {
      const n = new Set(prev);
      if (n.has(goalId)) n.delete(goalId);
      else n.add(goalId);
      return n;
    });
  }

  function toggleMilestone(id: string) {
    setExpandedMilestones((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const allByGoal = useMemo(() => {
    const m = new Map<string, TimelineRow[]>();
    for (const goal of goals) {
      const flat: TimelineRow[] = [];
      flattenAll(rootMilestonesByGoal.get(goal.id) ?? [], childrenByParent, 0, flat);
      m.set(goal.id, flat);
    }
    return m;
  }, [goals, rootMilestonesByGoal, childrenByParent]);

  /** Data-driven window: the union span of every goal's milestones, padded ~6% each side — stable regardless of expand state. */
  const naturalRange = useMemo(() => {
    let min: number | null = null;
    let max: number | null = null;
    for (const rows of allByGoal.values()) {
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
  }, [allByGoal]);

  const axisSpan = naturalRange.end - naturalRange.start;
  const axisStart = naturalRange.start + shift * axisSpan;
  const axisEnd = naturalRange.end + shift * axisSpan;

  const ticks = useMemo(() => buildTicks(axisStart, axisEnd), [axisStart, axisEnd]);

  const todayPct = useMemo(() => {
    const now = new Date().getTime();
    if (now < axisStart || now >= axisEnd) return null;
    return ((now - axisStart) / axisSpan) * 100;
  }, [axisStart, axisEnd, axisSpan]);

  /** One master toggle row per goal, followed by its milestones only when expanded — everything in one continuous run, no divider breaking up the bars. */
  const displayRows = useMemo(() => {
    const out: DisplayRow[] = [];
    for (const goal of goals) {
      const all = allByGoal.get(goal.id) ?? [];
      if (all.length === 0) continue;
      out.push({ kind: "goal", goal });
      if (expandedGoals.has(goal.id)) {
        const visible: TimelineRow[] = [];
        flattenExpanded(rootMilestonesByGoal.get(goal.id) ?? [], childrenByParent, expandedMilestones, 0, visible);
        for (const { milestone, depth } of visible) {
          const start = new Date(milestone.periodStart).getTime();
          const end = new Date(milestone.periodEnd).getTime();
          if (end >= axisStart && start < axisEnd) {
            out.push({ kind: "milestone", goal, milestone, depth });
          }
        }
      }
    }
    return out;
  }, [goals, allByGoal, rootMilestonesByGoal, childrenByParent, expandedGoals, expandedMilestones, axisStart, axisEnd]);

  const hasAnyGoals = goals.some((g) => (allByGoal.get(g.id)?.length ?? 0) > 0);

  const content = (
    <>
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
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 text-xs text-[var(--muted)] sm:flex">
            {(Object.keys(STATUS_LABELS) as (keyof typeof STATUS_LABELS)[]).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${STATUS_BAR_CLASS[s]}`} aria-hidden />
                {STATUS_LABELS[s]}
              </span>
            ))}
          </div>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
            onClick={() => setFocusMode((f) => !f)}
            aria-label={focusMode ? "Exit full screen" : "Full screen"}
          >
            {focusMode ? (
              <>
                <ArrowsIn weight="bold" className="size-4" />
                Exit full screen
              </>
            ) : (
              <ArrowsOut weight="bold" className="size-4" />
            )}
          </button>
        </div>
      </div>

      {!hasAnyGoals && !loading ? (
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-[var(--accent-muted)] text-[var(--accent)]" aria-hidden>
            <Flag size={24} weight="bold" />
          </span>
          <div>
            <p className="text-sm font-medium text-[var(--fg)]">No milestones yet</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Add a milestone from the outline view to see it here.</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="relative mb-1.5 h-5 border-b border-[var(--border-subtle)]">
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

            {/* One continuous run — each goal's master toggle row, then (if expanded) its milestone bars, no divider breaking the flow. */}
            <div className="space-y-1.5">
              {displayRows.map((row) => {
                if (row.kind === "goal") {
                  const isOpen = expandedGoals.has(row.goal.id);
                  return (
                    <div key={`goal-${row.goal.id}`} className="flex items-center gap-2">
                      <button
                        type="button"
                        className="flex h-8 flex-1 items-center gap-1.5 rounded-md px-1 text-left transition-colors hover:bg-[var(--surface-hover)]"
                        onClick={() => toggleGoal(row.goal.id)}
                        aria-label={isOpen ? `Collapse ${row.goal.title}` : `Expand ${row.goal.title}`}
                      >
                        <CaretRight
                          weight="bold"
                          className={`size-3.5 shrink-0 text-[var(--muted)] transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
                        />
                        <span className="truncate text-xs font-semibold uppercase tracking-wide text-[var(--fg)]">
                          {row.goal.title}
                        </span>
                      </button>
                      <span className="w-9 shrink-0 text-right text-xs tabular-nums text-[var(--muted)]">
                        {row.goal.progress.pct}%
                      </span>
                      <button
                        type="button"
                        className="flex size-6 shrink-0 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
                        onClick={() => onEditGoal(row.goal)}
                        aria-label={`Edit ${row.goal.title}`}
                        title="Edit goal"
                      >
                        <PencilSimple size={14} weight="bold" />
                      </button>
                    </div>
                  );
                }

                const { goal, milestone, depth } = row;
                const start = new Date(milestone.periodStart).getTime();
                const end = new Date(milestone.periodEnd).getTime();
                const left = Math.max(0, ((start - axisStart) / axisSpan) * 100);
                const right = Math.min(100, ((end - axisStart) / axisSpan) * 100);
                const width = Math.max(1.5, right - left);
                const hasChildren = (childrenByParent.get(milestone.id)?.length ?? 0) > 0;
                const isOpen = expandedMilestones.has(milestone.id);
                const depthStyle = milestoneDepthStyle(depth);
                return (
                  <div key={milestone.id} className="group flex items-center gap-2">
                    <div className={`relative flex-1 rounded-md bg-[var(--surface-muted)] ${depthStyle.trackClass}`}>
                      {todayPct != null && (
                        <div
                          className="absolute top-0 h-full w-px bg-[var(--accent)]"
                          style={{ left: `${todayPct}%` }}
                          aria-hidden
                        />
                      )}
                      <div
                        role="button"
                        tabIndex={0}
                        className={`absolute top-1 flex cursor-pointer items-center overflow-hidden rounded-md shadow-sm ${STATUS_BAR_CLASS[milestone.status]} transition-opacity hover:opacity-90 ${depthStyle.barClass}`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        onClick={() => onEditMilestone(milestone)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onEditMilestone(milestone);
                          }
                        }}
                        title={`${goal.title} › ${milestone.title} — ${milestone.progress.pct}% done`}
                        aria-label={`Edit ${milestone.title}, ${milestone.progress.pct}% done`}
                      >
                        {hasChildren && (
                          <button
                            type="button"
                            className="flex h-full shrink-0 items-center pl-1.5 pr-0.5 text-white/85 hover:text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleMilestone(milestone.id);
                            }}
                            aria-label={isOpen ? `Collapse ${milestone.title}` : `Expand ${milestone.title}`}
                          >
                            <CaretRight
                              weight="bold"
                              className={`size-3 transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
                            />
                          </button>
                        )}
                        <span className={`truncate px-2 text-white drop-shadow-sm ${depthStyle.textClass}`}>
                          {milestone.title}
                        </span>
                      </div>
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
        </div>
      )}
    </>
  );

  if (focusMode) {
    if (typeof document === "undefined") return null;
    return createPortal(
      <div className="fixed inset-0 z-[80] overflow-y-auto bg-[var(--surface-base)] p-4 md:p-6">{content}</div>,
      document.body,
    );
  }

  return (
    <div className="surface-elevated ui-elevated-panel rounded-2xl border border-[var(--border-subtle)] p-4">
      {content}
    </div>
  );
}
