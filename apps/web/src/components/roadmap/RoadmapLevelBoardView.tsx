"use client";

import { useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFlag } from "@fortawesome/free-solid-svg-icons";
import { STATUS_DOT_CLASS, STATUS_LABELS } from "@/lib/roadmap-format";
import { NODE_LABELS } from "@/lib/nodes";
import type { Dept, GoalRow, MilestoneRow } from "@/lib/ledger-types";

const ORG_WIDE_KEY = "__org__";

function MilestoneCard({
  milestone,
  goalTitle,
  onOpen,
}: {
  milestone: MilestoneRow;
  goalTitle: string | undefined;
  onOpen: (milestone: MilestoneRow) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(milestone)}
      onContextMenu={(e) => {
        e.preventDefault();
        onOpen(milestone);
      }}
      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3.5 text-left shadow-sm transition-[border-color,transform] duration-150 hover:-translate-y-px hover:border-[var(--border)]"
    >
      <div className="flex items-center gap-1.5">
        {goalTitle && (
          <span className="min-w-0 truncate rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
            {goalTitle}
          </span>
        )}
        <span
          className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT_CLASS[milestone.status]}`}
          title={STATUS_LABELS[milestone.status]}
          aria-hidden
        />
      </div>
      <p className="mt-2 truncate text-sm font-medium text-[var(--fg)]">{milestone.title}</p>
      <div className="mt-2.5 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-muted)]">
          <div className="h-full rounded-full bg-[var(--accent)]/70" style={{ width: `${milestone.progress.pct}%` }} />
        </div>
        <span className="w-8 shrink-0 text-right text-xs tabular-nums text-[var(--muted)]">{milestone.progress.pct}%</span>
      </div>
    </button>
  );
}

export function RoadmapLevelBoardView({
  milestones,
  goals,
  depts,
  loading,
  onOpen,
}: {
  milestones: MilestoneRow[];
  goals: GoalRow[];
  depts: Dept[];
  loading: boolean;
  onOpen: (milestone: MilestoneRow) => void;
}) {
  const goalTitleById = useMemo(() => new Map(goals.map((g) => [g.id, g.title] as const)), [goals]);

  const columns = useMemo(() => {
    const byDept = new Map<string, MilestoneRow[]>();
    byDept.set(ORG_WIDE_KEY, []);
    for (const d of depts) byDept.set(d.id, []);
    for (const m of milestones) {
      const key = m.departmentId ?? ORG_WIDE_KEY;
      const arr = byDept.get(key);
      if (arr) arr.push(m);
      else byDept.set(key, [m]);
    }
    for (const arr of byDept.values()) {
      arr.sort((a, b) => a.periodStart.localeCompare(b.periodStart) || a.orderIndex - b.orderIndex);
    }
    return [
      { id: ORG_WIDE_KEY, name: "Org-wide", items: byDept.get(ORG_WIDE_KEY) ?? [] },
      ...depts.map((d) => ({ id: d.id, name: d.name, items: byDept.get(d.id) ?? [] })),
    ];
  }, [milestones, depts]);

  if (milestones.length === 0 && !loading) {
    return (
      <div className="surface-elevated ui-elevated-panel flex flex-col items-center gap-3 rounded-2xl border border-[var(--border-subtle)] px-6 py-12 text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-[var(--accent-muted)] text-[var(--accent)]" aria-hidden>
          <FontAwesomeIcon icon={faFlag} className="size-6" />
        </span>
        <div>
          <p className="text-sm font-medium text-[var(--fg)]">No milestones yet</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Milestones will appear here grouped by {NODE_LABELS.level.toLowerCase()} once created.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-1">
      {columns.map((col) => (
        <div
          key={col.id}
          className="surface-elevated ui-elevated-panel w-72 shrink-0 rounded-2xl border border-[var(--border-subtle)] p-3.5"
        >
          <div className="mb-3 flex items-center justify-between px-0.5">
            <h3 className="truncate text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{col.name}</h3>
            <span className="shrink-0 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-xs tabular-nums text-[var(--muted)]">
              {col.items.length}
            </span>
          </div>
          <div className="space-y-2.5">
            {col.items.length === 0 ? (
              <p className="px-0.5 text-xs text-[var(--muted)]">No milestones</p>
            ) : (
              col.items.map((m) => (
                <MilestoneCard key={m.id} milestone={m} goalTitle={goalTitleById.get(m.goalId)} onOpen={onOpen} />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
