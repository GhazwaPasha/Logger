"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowsIn, ArrowsOut, CaretLeft, CaretRight, Flag, MapPin, PencilSimple } from "@phosphor-icons/react";
import { STATUS_BAR_CLASS, formatRange, milestoneDepthStyle } from "@/lib/roadmap-format";
import { buildTicks, clampZoomLevel, computeNaturalRange, fitZoomToRange, ZOOM_LEVELS, type Tick } from "@/lib/roadmap-axis";
import { ZoomLevelSwitch } from "@/components/roadmap/ZoomLevelSwitch";
import type { GoalRow, MilestoneRow } from "@/lib/ledger-types";

type TimelineRow = { milestone: MilestoneRow; depth: number };

/** Every descendant, unconditionally — used only for the axis date range, never for what's actually rendered. */
function flattenAll(roots: MilestoneRow[], childrenByParent: Map<string, MilestoneRow[]>, depth: number, out: TimelineRow[]) {
  for (const milestone of roots
    .slice()
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart) || a.orderIndex - b.orderIndex)) {
    out.push({ milestone, depth });
    flattenAll(childrenByParent.get(milestone.id) ?? [], childrenByParent, depth + 1, out);
  }
}

/** Once the goal's master toggle is open, the whole tree shows by default — a milestone's own children only hide once that specific branch is collapsed via its own bar-toggle. */
function flattenTree(
  roots: MilestoneRow[],
  childrenByParent: Map<string, MilestoneRow[]>,
  collapsedMilestones: Set<string>,
  depth: number,
  out: TimelineRow[],
) {
  for (const milestone of roots
    .slice()
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart) || a.orderIndex - b.orderIndex)) {
    out.push({ milestone, depth });
    if (!collapsedMilestones.has(milestone.id)) {
      flattenTree(childrenByParent.get(milestone.id) ?? [], childrenByParent, collapsedMilestones, depth + 1, out);
    }
  }
}

/**
 * One goal's fully self-contained mini-Gantt. Two tiers of expand/collapse (one master toggle
 * for the whole tree, one per-branch toggle on each bar), plus zoom (Day/Week/Month/Quarter/Year)
 * and pan (Earlier/Reset/Later buttons, or grab-and-drag anywhere on the timeline like a map).
 */
function GoalTimelineCard({
  goal,
  rootMilestones,
  childrenByParent,
  onEditGoal,
  onEditMilestone,
}: {
  goal: GoalRow;
  rootMilestones: MilestoneRow[];
  childrenByParent: Map<string, MilestoneRow[]>;
  onEditGoal: (goal: GoalRow) => void;
  onEditMilestone: (milestone: MilestoneRow) => void;
}) {
  const [focusMode, setFocusMode] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [collapsedMilestones, setCollapsedMilestones] = useState<Set<string>>(() => new Set());
  const [zoomLevel, setZoomLevel] = useState(0);
  const [centerDate, setCenterDate] = useState(() => new Date().getTime());
  const hasSeededRef = useRef(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startCenter: number; pointerId: number; widthPx: number } | null>(null);
  const justDraggedRef = useRef(false);

  useEffect(() => {
    if (!focusMode) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFocusMode(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [focusMode]);

  function toggleMilestone(id: string) {
    setCollapsedMilestones((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  /** Every descendant, regardless of expand state — the axis reflects the whole goal, not just what's currently shown. */
  const allRows = useMemo(() => {
    const out: TimelineRow[] = [];
    flattenAll(rootMilestones, childrenByParent, 0, out);
    return out;
  }, [rootMilestones, childrenByParent]);

  function fitToData() {
    const spans = allRows.map(({ milestone }) => ({
      start: new Date(milestone.periodStart).getTime(),
      end: new Date(milestone.periodEnd).getTime(),
    }));
    const fit = fitZoomToRange(computeNaturalRange(spans));
    setZoomLevel(fit.zoomLevel);
    setCenterDate(fit.centerDate);
  }

  // Seed zoom/pan from real data the first time it shows up — never again after, so it doesn't fight manual zoom/pan on refetch.
  useEffect(() => {
    if (hasSeededRef.current || allRows.length === 0) return;
    fitToData();
    hasSeededRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRows.length]);

  const axisSpan = ZOOM_LEVELS[zoomLevel]!.days * 24 * 60 * 60 * 1000;
  const axisStart = centerDate - axisSpan / 2;
  const axisEnd = centerDate + axisSpan / 2;

  const ticks: Tick[] = useMemo(
    () => buildTicks(axisStart, axisEnd, ZOOM_LEVELS[zoomLevel]!.granularity),
    [axisStart, axisEnd, zoomLevel],
  );

  const todayPct = useMemo(() => {
    const now = new Date().getTime();
    if (now < axisStart || now >= axisEnd) return null;
    return ((now - axisStart) / axisSpan) * 100;
  }, [axisStart, axisEnd, axisSpan]);

  const rows = useMemo(() => {
    if (!isExpanded) return [];
    const visible: TimelineRow[] = [];
    flattenTree(rootMilestones, childrenByParent, collapsedMilestones, 0, visible);
    return visible;
  }, [isExpanded, rootMilestones, childrenByParent, collapsedMilestones]);

  // Wheel-to-zoom: scroll over the timeline to step through Day/Week/Month/Quarter/Year, anchored on the
  // date under the cursor so that point stays put while the view zooms around it. Attached as a real
  // (non-passive) DOM listener so preventDefault reliably stops the page from also scrolling.
  useEffect(() => {
    const el = trackRef.current;
    if (!isExpanded || !el) return;
    function onWheel(e: WheelEvent) {
      if (!el || e.deltaY === 0) return;
      e.preventDefault();
      const direction = e.deltaY > 0 ? 1 : -1;
      const newLevel = clampZoomLevel(zoomLevel + direction);
      if (newLevel === zoomLevel) return;
      const rect = el.getBoundingClientRect();
      const cursorFrac = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0.5;
      const dateUnderCursor = axisStart + cursorFrac * axisSpan;
      const newSpan = ZOOM_LEVELS[newLevel]!.days * 24 * 60 * 60 * 1000;
      setZoomLevel(newLevel);
      setCenterDate(dateUnderCursor + newSpan * (0.5 - cursorFrac));
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [isExpanded, zoomLevel, axisStart, axisSpan]);

  function handlePointerDown(e: React.PointerEvent) {
    if (e.button !== 0 || !trackRef.current) return;
    dragRef.current = { startX: e.clientX, startCenter: centerDate, pointerId: e.pointerId, widthPx: trackRef.current.offsetWidth };
    justDraggedRef.current = false;
    trackRef.current.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || drag.widthPx === 0) return;
    const dx = e.clientX - drag.startX;
    if (Math.abs(dx) <= 4) return;
    justDraggedRef.current = true;
    const msPerPixel = axisSpan / drag.widthPx;
    setCenterDate(drag.startCenter - dx * msPerPixel);
  }

  function handlePointerUp() {
    const drag = dragRef.current;
    if (drag && trackRef.current) {
      try {
        trackRef.current.releasePointerCapture(drag.pointerId);
      } catch {
        /* already released */
      }
    }
    dragRef.current = null;
  }

  function editMilestoneUnlessDragged(milestone: MilestoneRow) {
    if (justDraggedRef.current) return;
    onEditMilestone(milestone);
  }

  const content = (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            className="flex size-5 shrink-0 items-center justify-center rounded text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
            onClick={() => setIsExpanded((v) => !v)}
            aria-label={isExpanded ? "Collapse all milestones" : "Expand all milestones"}
          >
            <CaretRight
              weight="bold"
              className={`size-3.5 transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}
            />
          </button>
          <button
            type="button"
            className="min-w-0 truncate text-left text-xs font-semibold uppercase tracking-wide text-[var(--fg)] hover:underline"
            onClick={() => onEditGoal(goal)}
          >
            {goal.title}
          </button>
          <span className="shrink-0 text-xs tabular-nums text-[var(--muted)]">{goal.progress.pct}%</span>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <ZoomLevelSwitch value={zoomLevel} onChange={(v) => setZoomLevel(clampZoomLevel(v))} />
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded-lg p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
              onClick={() => setCenterDate((c) => c - axisSpan / 2)}
              aria-label="Earlier"
            >
              <CaretLeft weight="bold" className="size-4" />
            </button>
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
              onClick={fitToData}
            >
              Reset
            </button>
            <button
              type="button"
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
              onClick={() => setCenterDate(new Date().getTime())}
              aria-label="Jump to today"
            >
              <MapPin weight="bold" className="size-3.5" />
              Today
            </button>
            <button
              type="button"
              className="rounded-lg p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
              onClick={() => setCenterDate((c) => c + axisSpan / 2)}
              aria-label="Later"
            >
              <CaretRight weight="bold" className="size-4" />
            </button>
          </div>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
            onClick={() => setFocusMode((f) => !f)}
            aria-label={focusMode ? "Exit full screen" : "Full screen"}
          >
            {focusMode ? <ArrowsIn weight="bold" className="size-4" /> : <ArrowsOut weight="bold" className="size-4" />}
          </button>
        </div>
      </div>

      {!isExpanded ? (
        <p className="px-1 text-xs text-[var(--muted)]">
          {allRows.length} milestone{allRows.length === 1 ? "" : "s"} — click the arrow to show them.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div
            ref={trackRef}
            className="min-w-[640px] cursor-grab select-none active:cursor-grabbing"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div className="mb-1.5 flex items-center gap-2">
              <div className="relative h-5 flex-1 border-b border-[var(--border-subtle)]">
                {ticks.map((t) => (
                  <span
                    key={t.pos}
                    className="absolute top-0 whitespace-nowrap text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]"
                    style={{ left: `${t.pos}%` }}
                  >
                    {t.label}
                  </span>
                ))}
              </div>
              <span className="w-9 shrink-0" aria-hidden />
              <span className="size-6 shrink-0" aria-hidden />
            </div>

            {rows.length === 0 ? (
              <p className="px-1 py-6 text-center text-sm text-[var(--muted)]">Nothing in this window — drag, zoom out, or Reset.</p>
            ) : (
              <div className="space-y-1.5">
                {rows.map(({ milestone, depth }) => {
                  const start = new Date(milestone.periodStart).getTime();
                  const end = new Date(milestone.periodEnd).getTime();
                  const left = Math.max(0, Math.min(100, ((start - axisStart) / axisSpan) * 100));
                  const right = Math.max(0, Math.min(100, ((end - axisStart) / axisSpan) * 100));
                  const width = Math.max(1.5, right - left);
                  const hasChildren = (childrenByParent.get(milestone.id)?.length ?? 0) > 0;
                  const isOpen = !collapsedMilestones.has(milestone.id);
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
                          onClick={() => editMilestoneUnlessDragged(milestone)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onEditMilestone(milestone);
                            }
                          }}
                          title={`${goal.title} › ${milestone.title} — ${formatRange(milestone.periodStart, milestone.periodEnd)} — ${milestone.progress.pct}% done`}
                          aria-label={`Edit ${milestone.title}, ${formatRange(milestone.periodStart, milestone.periodEnd)}, ${milestone.progress.pct}% done`}
                        >
                          {hasChildren && (
                            <button
                              type="button"
                              className="flex h-full shrink-0 items-center pl-1.5 pr-0.5 text-white/85 hover:text-white"
                              onPointerDown={(e) => e.stopPropagation()}
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
                        onPointerDown={(e) => e.stopPropagation()}
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
            )}
          </div>
        </div>
      )}
    </div>
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

export function RoadmapTimelineView({
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
  const goalsWithMilestones = goals.filter((g) => (rootMilestonesByGoal.get(g.id)?.length ?? 0) > 0);

  if (goalsWithMilestones.length === 0 && !loading) {
    return (
      <div className="surface-elevated ui-elevated-panel flex flex-col items-center gap-3 rounded-2xl border border-[var(--border-subtle)] px-6 py-12 text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-[var(--accent-muted)] text-[var(--accent)]" aria-hidden>
          <Flag size={24} weight="bold" />
        </span>
        <div>
          <p className="text-sm font-medium text-[var(--fg)]">No milestones yet</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Add a milestone from the outline view to see it here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {goalsWithMilestones.map((goal) => (
        <GoalTimelineCard
          key={goal.id}
          goal={goal}
          rootMilestones={rootMilestonesByGoal.get(goal.id) ?? []}
          childrenByParent={childrenByParent}
          onEditGoal={onEditGoal}
          onEditMilestone={onEditMilestone}
        />
      ))}
    </div>
  );
}
