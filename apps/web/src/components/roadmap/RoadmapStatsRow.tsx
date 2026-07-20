"use client";

import { useMemo } from "react";
import type { RoadmapItemRow } from "@/lib/ledger-types";

function StatTile({
  label,
  value,
  tone,
  loading,
}: {
  label: string;
  value: string;
  tone?: "warn";
  loading: boolean;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-3.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p
        className={`mt-0.5 text-3xl font-semibold tabular-nums leading-none tracking-tight ${
          tone === "warn" ? "text-amber-600 dark:text-amber-400" : ""
        }`}
      >
        {loading ? "…" : value}
      </p>
    </div>
  );
}

export function RoadmapStatsRow({ items, loading }: { items: RoadmapItemRow[]; loading: boolean }) {
  const stats = useMemo(() => {
    const now = new Date().getTime();
    const total = items.length;
    let active = 0;
    let atRisk = 0;
    for (const i of items) {
      const start = new Date(i.periodStart).getTime();
      const end = new Date(i.periodEnd).getTime();
      if (start <= now && now <= end) active++;
      if (i.status === "at_risk") atRisk++;
    }
    const roots = items.filter((i) => !i.parentId);
    const rollup = roots.reduce(
      (acc, r) => ({ done: acc.done + r.progress.done, total: acc.total + r.progress.total }),
      { done: 0, total: 0 },
    );
    const overallPct = rollup.total > 0 ? Math.round((rollup.done / rollup.total) * 100) : 0;
    return { total, active, atRisk, overallPct, hasTasks: rollup.total > 0 };
  }, [items]);

  if (items.length === 0 && !loading) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile label="Total goals" value={String(stats.total)} loading={loading} />
      <StatTile label="Active now" value={String(stats.active)} loading={loading} />
      <StatTile label="At risk" value={String(stats.atRisk)} tone={stats.atRisk > 0 ? "warn" : undefined} loading={loading} />
      <StatTile
        label="Overall progress"
        value={stats.hasTasks ? `${stats.overallPct}%` : "—"}
        loading={loading}
      />
    </div>
  );
}
