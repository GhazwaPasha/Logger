"use client";

import { useMemo } from "react";
import { Target } from "@phosphor-icons/react";
import { PERIOD_BADGE_CLASS, PERIOD_LABELS, STATUS_DOT_CLASS, STATUS_LABELS } from "@/lib/roadmap-format";
import type { Dept, RoadmapItemRow } from "@/lib/ledger-types";

const ORG_WIDE_KEY = "__org__";

function GoalCard({ item, onOpen }: { item: RoadmapItemRow; onOpen: (item: RoadmapItemRow) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3.5 text-left shadow-sm transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-px hover:border-[var(--border)] hover:shadow-md"
    >
      <div className="flex items-center gap-1.5">
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PERIOD_BADGE_CLASS[item.period]}`}
        >
          {PERIOD_LABELS[item.period]}
        </span>
        <span className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT_CLASS[item.status]}`} title={STATUS_LABELS[item.status]} aria-hidden />
      </div>
      <p className="mt-2 truncate text-sm font-medium text-[var(--fg)]">{item.title}</p>
      <div className="mt-2.5 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-muted)]">
          <div className="h-full rounded-full bg-[var(--accent)]/70" style={{ width: `${item.progress.pct}%` }} />
        </div>
        <span className="w-8 shrink-0 text-right text-xs tabular-nums text-[var(--muted)]">{item.progress.pct}%</span>
      </div>
    </button>
  );
}

export function RoadmapLevelBoardView({
  items,
  depts,
  loading,
  onOpen,
}: {
  items: RoadmapItemRow[];
  depts: Dept[];
  loading: boolean;
  onOpen: (item: RoadmapItemRow) => void;
}) {
  const columns = useMemo(() => {
    const byDept = new Map<string, RoadmapItemRow[]>();
    byDept.set(ORG_WIDE_KEY, []);
    for (const d of depts) byDept.set(d.id, []);
    for (const item of items) {
      const key = item.departmentId ?? ORG_WIDE_KEY;
      const arr = byDept.get(key);
      if (arr) arr.push(item);
      else byDept.set(key, [item]);
    }
    for (const arr of byDept.values()) {
      arr.sort((a, b) => a.periodStart.localeCompare(b.periodStart) || a.orderIndex - b.orderIndex);
    }
    return [
      { id: ORG_WIDE_KEY, name: "Org-wide", items: byDept.get(ORG_WIDE_KEY) ?? [] },
      ...depts.map((d) => ({ id: d.id, name: d.name, items: byDept.get(d.id) ?? [] })),
    ];
  }, [items, depts]);

  if (items.length === 0 && !loading) {
    return (
      <div className="surface-elevated ui-elevated-panel flex flex-col items-center gap-3 rounded-2xl border border-[var(--border-subtle)] px-6 py-12 text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-[var(--accent-muted)] text-[var(--accent)]" aria-hidden>
          <Target size={24} weight="bold" />
        </span>
        <div>
          <p className="text-sm font-medium text-[var(--fg)]">No goals yet</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Goals will appear here grouped by level once created.</p>
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
              <p className="px-0.5 text-xs text-[var(--muted)]">No goals</p>
            ) : (
              col.items.map((item) => <GoalCard key={item.id} item={item} onOpen={onOpen} />)
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
