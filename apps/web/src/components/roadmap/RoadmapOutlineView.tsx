"use client";

import { CaretRight, Flag, Plus } from "@phosphor-icons/react";
import { STATUS_DOT_CLASS, STATUS_LABELS, formatRange } from "@/lib/roadmap-format";
import type { GoalRow, MilestoneRow } from "@/lib/ledger-types";

function MilestoneRowItem({
  milestone,
  depth,
  childrenByParent,
  expanded,
  onToggle,
  onOpen,
  onAddChild,
}: {
  milestone: MilestoneRow;
  depth: number;
  childrenByParent: Map<string, MilestoneRow[]>;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onOpen: (milestone: MilestoneRow) => void;
  onAddChild: (parent: MilestoneRow) => void;
}) {
  const children = childrenByParent.get(milestone.id) ?? [];
  const hasChildren = children.length > 0;
  const isOpen = expanded.has(milestone.id);
  const pct = milestone.progress.pct;

  return (
    <div>
      <div
        className="group flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--surface-hover)]"
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
      >
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

        <span
          className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT_CLASS[milestone.status]}`}
          title={STATUS_LABELS[milestone.status]}
          aria-hidden
        />

        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left text-sm font-medium text-[var(--fg)]"
          onClick={() => onOpen(milestone)}
        >
          {milestone.title}
        </button>

        <span className="hidden shrink-0 text-xs text-[var(--muted)] sm:inline">
          {formatRange(milestone.periodStart, milestone.periodEnd)}
        </span>

        <div className="flex w-36 shrink-0 items-center gap-2.5">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-muted)]">
            <div className="h-full rounded-full bg-[var(--accent)]/70 transition-[width]" style={{ width: `${pct}%` }} />
          </div>
          <span className="w-8 shrink-0 text-right text-xs tabular-nums text-[var(--muted)]">{pct}%</span>
        </div>

        <button
          type="button"
          className="shrink-0 rounded-md p-1 text-[var(--muted)] opacity-0 transition-opacity hover:bg-[var(--surface-muted)] hover:text-[var(--fg)] group-hover:opacity-100"
          onClick={() => onAddChild(milestone)}
          aria-label={`Add sub-milestone under ${milestone.title}`}
        >
          <Plus weight="bold" className="size-3.5" />
        </button>
      </div>

      {isOpen &&
        children
          .slice()
          .sort((a, b) => a.periodStart.localeCompare(b.periodStart) || a.orderIndex - b.orderIndex)
          .map((child) => (
            <MilestoneRowItem
              key={child.id}
              milestone={child}
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

function GoalRowItem({
  goal,
  rootMilestones,
  childrenByParent,
  expanded,
  onToggle,
  onOpenGoal,
  onOpenMilestone,
  onAddMilestone,
  onAddSubMilestone,
}: {
  goal: GoalRow;
  rootMilestones: MilestoneRow[];
  childrenByParent: Map<string, MilestoneRow[]>;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onOpenGoal: (goal: GoalRow) => void;
  onOpenMilestone: (milestone: MilestoneRow) => void;
  onAddMilestone: (goal: GoalRow) => void;
  onAddSubMilestone: (parent: MilestoneRow) => void;
}) {
  const hasMilestones = rootMilestones.length > 0;
  const isOpen = expanded.has(goal.id);
  const pct = goal.progress.pct;

  return (
    <div>
      <div className="group flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--surface-hover)]">
        <button
          type="button"
          className="flex size-5 shrink-0 items-center justify-center text-[var(--muted)]"
          onClick={() => hasMilestones && onToggle(goal.id)}
          aria-label={hasMilestones ? (isOpen ? "Collapse" : "Expand") : undefined}
        >
          {hasMilestones ? (
            <CaretRight weight="bold" className={`size-3.5 transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`} />
          ) : null}
        </button>

        <span
          className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT_CLASS[goal.status]}`}
          title={STATUS_LABELS[goal.status]}
          aria-hidden
        />

        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-[var(--fg)]"
          onClick={() => onOpenGoal(goal)}
        >
          {goal.title}
        </button>

        <div className="flex w-36 shrink-0 items-center gap-2.5">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-muted)]">
            <div className="h-full rounded-full bg-[var(--accent)]/70 transition-[width]" style={{ width: `${pct}%` }} />
          </div>
          <span className="w-8 shrink-0 text-right text-xs tabular-nums text-[var(--muted)]">{pct}%</span>
        </div>

        <button
          type="button"
          className="shrink-0 rounded-md p-1 text-[var(--muted)] opacity-0 transition-opacity hover:bg-[var(--surface-muted)] hover:text-[var(--fg)] group-hover:opacity-100"
          onClick={() => onAddMilestone(goal)}
          aria-label={`Add milestone under ${goal.title}`}
        >
          <Plus weight="bold" className="size-3.5" />
        </button>
      </div>

      {isOpen &&
        rootMilestones
          .slice()
          .sort((a, b) => a.periodStart.localeCompare(b.periodStart) || a.orderIndex - b.orderIndex)
          .map((m) => (
            <MilestoneRowItem
              key={m.id}
              milestone={m}
              depth={1}
              childrenByParent={childrenByParent}
              expanded={expanded}
              onToggle={onToggle}
              onOpen={onOpenMilestone}
              onAddChild={onAddSubMilestone}
            />
          ))}
    </div>
  );
}

export function RoadmapOutlineView({
  goals,
  rootMilestonesByGoal,
  childrenByParent,
  expanded,
  loading,
  onToggle,
  onOpenGoal,
  onOpenMilestone,
  onAddMilestone,
  onAddSubMilestone,
  onCreateGoal,
}: {
  goals: GoalRow[];
  rootMilestonesByGoal: Map<string, MilestoneRow[]>;
  childrenByParent: Map<string, MilestoneRow[]>;
  expanded: Set<string>;
  loading: boolean;
  onToggle: (id: string) => void;
  onOpenGoal: (goal: GoalRow) => void;
  onOpenMilestone: (milestone: MilestoneRow) => void;
  onAddMilestone: (goal: GoalRow) => void;
  onAddSubMilestone: (parent: MilestoneRow) => void;
  onCreateGoal?: () => void;
}) {
  return (
    <div className="surface-elevated ui-elevated-panel rounded-2xl border border-[var(--border-subtle)] p-3">
      {goals.length === 0 && !loading ? (
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-[var(--accent-muted)] text-[var(--accent)]" aria-hidden>
            <Flag size={24} weight="bold" />
          </span>
          <div>
            <p className="text-sm font-medium text-[var(--fg)]">No goals yet</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Create a goal, then break it into milestones dated however the work actually needs.
            </p>
          </div>
          {onCreateGoal && (
            <button type="button" className="btn-primary mt-1 rounded-xl px-4 py-2 text-sm font-semibold" onClick={onCreateGoal}>
              New goal
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-subtle)]/60">
          {goals.map((goal) => (
            <GoalRowItem
              key={goal.id}
              goal={goal}
              rootMilestones={rootMilestonesByGoal.get(goal.id) ?? []}
              childrenByParent={childrenByParent}
              expanded={expanded}
              onToggle={onToggle}
              onOpenGoal={onOpenGoal}
              onOpenMilestone={onOpenMilestone}
              onAddMilestone={onAddMilestone}
              onAddSubMilestone={onAddSubMilestone}
            />
          ))}
        </div>
      )}
    </div>
  );
}
