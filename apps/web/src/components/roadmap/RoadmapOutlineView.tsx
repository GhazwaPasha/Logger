"use client";

import { CaretRight, Plus, Target } from "@phosphor-icons/react";
import { PERIOD_BADGE_CLASS, PERIOD_LABELS, STATUS_DOT_CLASS, STATUS_LABELS, formatRange } from "@/lib/roadmap-format";
import type { RoadmapItemRow } from "@/lib/ledger-types";

function RoadmapRow({
  item,
  depth,
  childrenByParent,
  expanded,
  onToggle,
  onOpen,
  onAddChild,
}: {
  item: RoadmapItemRow;
  depth: number;
  childrenByParent: Map<string, RoadmapItemRow[]>;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onOpen: (item: RoadmapItemRow) => void;
  onAddChild: (parent: RoadmapItemRow) => void;
}) {
  const children = childrenByParent.get(item.id) ?? [];
  const hasChildren = children.length > 0;
  const isOpen = expanded.has(item.id);
  const pct = item.progress.pct;

  return (
    <div>
      <div
        className="group flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--surface-hover)]"
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
      >
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

        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${PERIOD_BADGE_CLASS[item.period]}`}
        >
          {PERIOD_LABELS[item.period]}
        </span>

        <span
          className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT_CLASS[item.status]}`}
          title={STATUS_LABELS[item.status]}
          aria-hidden
        />

        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left text-sm font-medium text-[var(--fg)]"
          onClick={() => onOpen(item)}
        >
          {item.title}
        </button>

        <span className="hidden shrink-0 text-xs text-[var(--muted)] sm:inline">
          {formatRange(item.periodStart, item.periodEnd)}
        </span>

        <div className="flex w-36 shrink-0 items-center gap-2.5">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-muted)]">
            <div
              className="h-full rounded-full bg-[var(--accent)]/70 transition-[width]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-xs tabular-nums text-[var(--muted)]">{pct}%</span>
        </div>

        {item.period !== "weekly" && (
          <button
            type="button"
            className="shrink-0 rounded-md p-1 text-[var(--muted)] opacity-0 transition-opacity hover:bg-[var(--surface-muted)] hover:text-[var(--fg)] group-hover:opacity-100"
            onClick={() => onAddChild(item)}
            aria-label={`Add child goal under ${item.title}`}
          >
            <Plus weight="bold" className="size-3.5" />
          </button>
        )}
      </div>

      {isOpen &&
        children
          .slice()
          .sort((a, b) => a.periodStart.localeCompare(b.periodStart) || a.orderIndex - b.orderIndex)
          .map((child) => (
            <RoadmapRow
              key={child.id}
              item={child}
              depth={depth + 1}
              childrenByParent={childrenByParent}
              expanded={expanded}
              onToggle={onToggle}
              onOpen={onOpen}
              onAddChild={onAddChild}
            />
          ))}
    </div>
  );
}

export function RoadmapOutlineView({
  roots,
  childrenByParent,
  expanded,
  loading,
  onToggle,
  onOpen,
  onAddChild,
  onCreateRoot,
}: {
  roots: RoadmapItemRow[];
  childrenByParent: Map<string, RoadmapItemRow[]>;
  expanded: Set<string>;
  loading: boolean;
  onToggle: (id: string) => void;
  onOpen: (item: RoadmapItemRow) => void;
  onAddChild: (parent: RoadmapItemRow) => void;
  onCreateRoot?: () => void;
}) {
  return (
    <div className="surface-elevated ui-elevated-panel rounded-2xl border border-[var(--border-subtle)] p-3">
      {roots.length === 0 && !loading ? (
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-[var(--accent-muted)] text-[var(--accent)]" aria-hidden>
            <Target size={24} weight="bold" />
          </span>
          <div>
            <p className="text-sm font-medium text-[var(--fg)]">No goals yet</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Start with a yearly goal, then split it into quarters, months, and weeks.
            </p>
          </div>
          {onCreateRoot && (
            <button type="button" className="btn-primary mt-1 rounded-xl px-4 py-2 text-sm font-semibold" onClick={onCreateRoot}>
              New goal
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-subtle)]/60">
          {roots.map((item) => (
            <RoadmapRow
              key={item.id}
              item={item}
              depth={0}
              childrenByParent={childrenByParent}
              expanded={expanded}
              onToggle={onToggle}
              onOpen={onOpen}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}
