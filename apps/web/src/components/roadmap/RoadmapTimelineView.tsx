"use client";

import { useMemo, useState } from "react";
import { CaretLeft, CaretRight, PencilSimple, Target } from "@phosphor-icons/react";
import { PERIOD_LABELS, STATUS_BAR_CLASS, STATUS_LABELS } from "@/lib/roadmap-format";
import type { RoadmapItemRow } from "@/lib/ledger-types";

const QUARTER_START_MONTHS = [0, 3, 6, 9];

type TimelineRow = { item: RoadmapItemRow; depth: number };

function flattenVisible(
  roots: RoadmapItemRow[],
  childrenByParent: Map<string, RoadmapItemRow[]>,
  expanded: Set<string>,
  depth: number,
  out: TimelineRow[],
) {
  for (const item of roots
    .slice()
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart) || a.orderIndex - b.orderIndex)) {
    out.push({ item, depth });
    if (expanded.has(item.id)) {
      flattenVisible(childrenByParent.get(item.id) ?? [], childrenByParent, expanded, depth + 1, out);
    }
  }
}

export function RoadmapTimelineView({
  roots,
  childrenByParent,
  expanded,
  loading,
  onToggle,
  onEdit,
}: {
  roots: RoadmapItemRow[];
  childrenByParent: Map<string, RoadmapItemRow[]>;
  expanded: Set<string>;
  loading: boolean;
  onToggle: (id: string) => void;
  onEdit: (item: RoadmapItemRow) => void;
}) {
  const [focusYear, setFocusYear] = useState(() => new Date().getUTCFullYear());

  const axisStart = Date.UTC(focusYear, 0, 1);
  const axisEnd = Date.UTC(focusYear + 1, 0, 1);
  const axisSpan = axisEnd - axisStart;

  const rows = useMemo(() => {
    const flat: TimelineRow[] = [];
    flattenVisible(roots, childrenByParent, expanded, 0, flat);
    return flat.filter(({ item }) => {
      const start = new Date(item.periodStart).getTime();
      const end = new Date(item.periodEnd).getTime();
      return end >= axisStart && start < axisEnd;
    });
  }, [roots, childrenByParent, expanded, axisStart, axisEnd]);

  const todayPct = useMemo(() => {
    const now = new Date().getTime();
    if (now < axisStart || now >= axisEnd) return null;
    return ((now - axisStart) / axisSpan) * 100;
  }, [axisStart, axisEnd, axisSpan]);

  return (
    <div className="surface-elevated ui-elevated-panel rounded-2xl border border-[var(--border-subtle)] p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-lg p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
            onClick={() => setFocusYear((y) => y - 1)}
            aria-label="Previous year"
          >
            <CaretLeft weight="bold" className="size-4" />
          </button>
          <span className="w-14 text-center text-sm font-semibold tabular-nums text-[var(--fg)]">{focusYear}</span>
          <button
            type="button"
            className="rounded-lg p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
            onClick={() => setFocusYear((y) => y + 1)}
            aria-label="Next year"
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

      {rows.length === 0 && !loading ? (
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-[var(--accent-muted)] text-[var(--accent)]" aria-hidden>
            <Target size={24} weight="bold" />
          </span>
          <div>
            <p className="text-sm font-medium text-[var(--fg)]">No goals in {focusYear}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Try a different year, or add a goal from the outline view.</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            {/* Quarter gridline header — mirrors the row layout (toggle + track + % + edit columns) so gridlines line up with the bars below */}
            <div className="mb-1.5 flex items-center gap-2">
              <span className="size-5 shrink-0" aria-hidden />
              <div className="relative h-5 flex-1 border-b border-[var(--border-subtle)]">
                {QUARTER_START_MONTHS.map((m) => (
                  <span
                    key={m}
                    className="absolute top-0 text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]"
                    style={{ left: `${((Date.UTC(focusYear, m, 1) - axisStart) / axisSpan) * 100}%` }}
                  >
                    {new Date(Date.UTC(focusYear, m, 1)).toLocaleDateString(undefined, { month: "short" })}
                  </span>
                ))}
              </div>
              <span className="w-9 shrink-0" aria-hidden />
              <span className="size-6 shrink-0" aria-hidden />
            </div>

            <div className="space-y-1.5">
              {rows.map(({ item, depth }) => {
                const start = new Date(item.periodStart).getTime();
                const end = new Date(item.periodEnd).getTime();
                const left = Math.max(0, ((start - axisStart) / axisSpan) * 100);
                const right = Math.min(100, ((end - axisStart) / axisSpan) * 100);
                const width = Math.max(1.5, right - left);
                const hasChildren = (childrenByParent.get(item.id)?.length ?? 0) > 0;
                const isOpen = expanded.has(item.id);
                return (
                  <div key={item.id} className="group flex items-center gap-2">
                    <button
                      type="button"
                      className="flex size-5 shrink-0 items-center justify-center text-[var(--muted)]"
                      onClick={() => hasChildren && onToggle(item.id)}
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
                        className={`absolute top-1 flex h-6 items-center overflow-hidden rounded-md px-2 shadow-sm ${STATUS_BAR_CLASS[item.status]} transition-opacity hover:opacity-90`}
                        style={{ left: `${left}%`, width: `${width}%`, paddingLeft: `${8 + depth * 10}px` }}
                        onClick={() => onEdit(item)}
                        title={`${item.title} — ${PERIOD_LABELS[item.period]} · ${item.progress.pct}% done`}
                        aria-label={`Edit ${item.title}, ${item.progress.pct}% done`}
                      >
                        <span className="truncate text-[11px] font-semibold text-white drop-shadow-sm">
                          {item.title}
                        </span>
                      </button>
                    </div>
                    <span className="w-9 shrink-0 text-right text-xs tabular-nums text-[var(--muted)]">
                      {item.progress.pct}%
                    </span>
                    <button
                      type="button"
                      className="flex size-6 shrink-0 items-center justify-center rounded-md text-[var(--muted)] opacity-0 transition-opacity hover:bg-[var(--surface-hover)] hover:text-[var(--fg)] group-hover:opacity-100"
                      onClick={() => onEdit(item)}
                      aria-label={`Edit ${item.title}`}
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
    </div>
  );
}
