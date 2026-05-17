"use client";

import { useState } from "react";
import type { MemberRow, TaskRow } from "@/lib/ledger-types";
import { normalizeTaskStatus } from "@/lib/task-board";

type Props = {
  tasks: TaskRow[];
  members: MemberRow[];
  onOpenTask: (taskId: string) => void;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function memberName(members: MemberRow[], userId: string): string {
  const m = members.find((x) => x.userId === userId);
  return m?.name?.trim() || m?.email || "Unknown";
}

/** Groups recurring task chain into a single collapsible card (Done/Cancelled columns). */
export function RecurringSeriesCard({ tasks, members, onOpenTask }: Props) {
  const [expanded, setExpanded] = useState(false);

  // Sort newest-first by createdAt
  const sorted = [...tasks].sort(
    (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
  );
  const latest = sorted[0]!;
  const count = sorted.length;
  const lastDone = sorted.find((t) => normalizeTaskStatus(t.status) === "done");

  return (
    <li className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] overflow-hidden">
      {/* Series header row */}
      <div className="flex items-start gap-2.5 px-3 pt-3 pb-2">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onOpenTask(latest.id)}
            className="text-left text-sm font-medium leading-snug text-[var(--fg)] hover:underline line-clamp-2"
          >
            {latest.title}
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono-ledger text-[10px] text-[var(--muted)]">
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-hover)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
              <svg width="8" height="8" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.75 3.75a.75.75 0 0 0-1.5 0v3.5l2.25 2.25a.75.75 0 1 0 1.06-1.06L8.75 7.69V4.75z"/>
              </svg>
              Recurring · {count} {count === 1 ? "completion" : "completions"}
            </span>
            {lastDone?.dueAt && (
              <span>Last: {formatDate(lastDone.dueAt)}</span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((x) => !x)}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse series" : "Expand series"}
          className="mt-0.5 shrink-0 rounded-md p-1 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-hover)] transition-colors"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
            className={`transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Occurrence list */}
      {expanded && (
        <ul className="border-t border-[var(--border-subtle)]/50 divide-y divide-[var(--border-subtle)]/30">
          {sorted.map((t) => (
            <li key={t.id} className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1 font-mono-ledger text-[11px] text-[var(--muted)]">
                {formatDate(t.dueAt)}
                {t.assigneeUserIds?.length ? (
                  <span className="ml-1.5 text-[var(--fg)]/70">
                    {t.assigneeUserIds.map((id) => memberName(members, id)).join(", ")}
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => onOpenTask(t.id)}
                className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                Open
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
