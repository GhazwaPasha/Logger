"use client";

import { useMemo, useState } from "react";
import { nameInitials } from "@/lib/member-utils";
import type { PerformanceScorecardRow } from "@/lib/ledger-types";

type SortKey = "completed" | "onTimeRate" | "pending" | "inProgress" | "lateTotal" | "timeLoggedSeconds";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "inProgress", label: "In progress" },
  { key: "completed", label: "Done" },
  { key: "lateTotal", label: "Late" },
  { key: "onTimeRate", label: "On-time" },
  { key: "timeLoggedSeconds", label: "Time logged" },
];

/** Late across every status — still-open and overdue, plus completed after the due date. */
function lateTotal(m: PerformanceScorecardRow): number {
  return m.latePending + m.lateInProgress + m.late;
}

function LateCount({ value }: { value: number }) {
  return <span className={value > 0 ? "text-rose-600 dark:text-rose-400" : "text-[var(--muted)]"}>{value}</span>;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0h";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  if (hrs === 0) return `${mins}m`;
  return mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`;
}

/** Read-only overview of every scoped member at once — selecting a person for a detailed breakdown happens via the chips below, not from this table. */
export function TeamScorecardTable({ members, loading }: { members: PerformanceScorecardRow[]; loading: boolean }) {
  const [sortKey, setSortKey] = useState<SortKey>("completed");
  const [sortDesc, setSortDesc] = useState(true);

  const sorted = useMemo(() => {
    const rows = [...members];
    rows.sort((a, b) => {
      const av = sortKey === "lateTotal" ? lateTotal(a) : a[sortKey];
      const bv = sortKey === "lateTotal" ? lateTotal(b) : b[sortKey];
      return sortDesc ? bv - av : av - bv;
    });
    return rows;
  }, [members, sortKey, sortDesc]);

  const maxCompleted = Math.max(1, ...members.map((m) => m.completed));

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDesc((d) => !d);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  }

  if (!loading && members.length === 0) {
    return <p className="mt-2 text-sm text-[var(--muted)]">No one in scope for this range yet.</p>;
  }

  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[42rem] border-collapse text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--muted)]">
            <th className="pb-1.5 pr-2 font-medium">Person</th>
            {COLUMNS.map((col) => (
              <th key={col.key} className="pb-1.5 pl-2 font-medium">
                <button
                  type="button"
                  onClick={() => toggleSort(col.key)}
                  className="inline-flex items-center gap-1 tabular-nums text-[var(--muted)] hover:text-[var(--fg)]"
                >
                  {col.label}
                  {sortKey === col.key ? <span aria-hidden>{sortDesc ? "↓" : "↑"}</span> : null}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {sorted.map((m) => (
            <tr key={m.userId}>
              <td className="py-2 pr-2">
                <div className="flex min-w-0 items-center gap-2">
                  {m.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.image} alt="" className="size-6 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-muted)] text-[10px] font-semibold text-[var(--fg)]">
                      {nameInitials(m.name, m.email)}
                    </span>
                  )}
                  <span className="min-w-0 truncate font-medium text-[var(--fg)]">{m.name || m.email}</span>
                </div>
                <div className="mt-1 h-1.5 w-full max-w-[10rem] overflow-hidden rounded-full bg-[var(--surface-muted)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]/50"
                    style={{ width: `${(m.completed / maxCompleted) * 100}%` }}
                  />
                </div>
              </td>
              <td className="py-2 pl-2 tabular-nums text-[var(--fg)]">{m.pending}</td>
              <td className="py-2 pl-2 tabular-nums text-[var(--fg)]">{m.inProgress}</td>
              <td className="py-2 pl-2 tabular-nums font-medium text-[var(--fg)]">{m.completed}</td>
              <td className="py-2 pl-2 tabular-nums">
                <LateCount value={lateTotal(m)} />
              </td>
              <td className="py-2 pl-2 tabular-nums">
                {m.onTime + m.late > 0 ? (
                  <span
                    className={
                      m.onTimeRate >= 0.8
                        ? "text-emerald-600 dark:text-emerald-400"
                        : m.onTimeRate >= 0.5
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-rose-600 dark:text-rose-400"
                    }
                  >
                    {Math.round(m.onTimeRate * 100)}%
                  </span>
                ) : (
                  <span className="text-[var(--muted)]">—</span>
                )}
              </td>
              <td className="py-2 pl-2 tabular-nums text-[var(--fg)]">{formatDuration(m.timeLoggedSeconds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
