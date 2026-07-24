"use client";

import { useMemo } from "react";
import type { GoalRow, MilestoneRow } from "@/lib/ledger-types";

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
    <div className="min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-2.5">
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

export function RoadmapStatsRow({
  goals,
  milestones,
  loading,
}: {
  goals: GoalRow[];
  milestones: MilestoneRow[];
  loading: boolean;
}) {
  const stats = useMemo(() => {
    const now = new Date().getTime();
    let active = 0;
    for (const m of milestones) {
      const start = new Date(m.periodStart).getTime();
      const end = new Date(m.periodEnd).getTime();
      if (start <= now && now <= end) active++;
    }
    const atRisk =
      goals.filter((g) => g.status === "at_risk").length + milestones.filter((m) => m.status === "at_risk").length;
    const rollup = goals.reduce(
      (acc, g) => ({ done: acc.done + g.progress.done, total: acc.total + g.progress.total }),
      { done: 0, total: 0 },
    );
    const overallPct = rollup.total > 0 ? Math.round((rollup.done / rollup.total) * 100) : 0;
    return { total: goals.length, active, atRisk, overallPct, hasTasks: rollup.total > 0 };
  }, [goals, milestones]);

  if (goals.length === 0 && !loading) return null;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <StatTile label="Goals" value={String(stats.total)} loading={loading} />
      <StatTile label="Active now" value={String(stats.active)} loading={loading} />
      <StatTile label="At risk" value={String(stats.atRisk)} tone={stats.atRisk > 0 ? "warn" : undefined} loading={loading} />
      <StatTile label="Overall progress" value={stats.hasTasks ? `${stats.overallPct}%` : "—"} loading={loading} />
    </div>
  );
}
