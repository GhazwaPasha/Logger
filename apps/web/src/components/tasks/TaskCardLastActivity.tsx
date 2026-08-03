"use client";

import type React from "react";
import type { LedgerRow, MemberRow } from "@/lib/ledger-types";
import { LedgerLineDescription } from "@/components/tasks/LedgerLineDescription";
import { formatLogTimestamp } from "@/lib/task-activity-log";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";

type Props = {
  entry: LedgerRow;
  members: MemberRow[];
  taskDueAt?: string | null;
  /** Tighter line clamp for dense kanban columns */
  compact?: boolean;
  /**
   * `inline` — dense preview without footer chrome (rare; list/kanban use `footer`).
   * `footer` — card footer with border-top separator (default; list + kanban).
   */
  variant?: "inline" | "footer";
  /** Optional node pinned to the right of the footer row (e.g. comment button). */
  right?: React.ReactNode;
};

/** Ledger preview for list (under title) or kanban (card footer). */
export function TaskCardLastActivity({ entry, members, taskDueAt, compact, variant = "footer", right }: Props) {
  const { timeZone } = useWorkspaceRoute();
  const lineClamp = compact ? "line-clamp-2" : variant === "inline" ? "line-clamp-2" : "line-clamp-3";

  if (variant === "inline") {
    return (
      <div className="min-w-0 font-mono-ledger text-[11px] leading-snug" aria-label="Last activity">
        <p className={`min-w-0 text-[var(--muted)] ${lineClamp}`}>
          <span className="text-[var(--muted)]">{formatLogTimestamp(entry.createdAt, timeZone)}</span>
          <span className="text-[var(--muted)]">: </span>
          <span className="text-[var(--fg)]/90">
            <LedgerLineDescription entry={entry} members={members} taskDueAt={taskDueAt} />
          </span>
        </p>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 border-t border-[var(--border-subtle)]/50 ${compact ? "px-2.5 pb-2 pt-1.5" : "px-4 pb-3 pt-2"} font-mono-ledger text-[11px] leading-snug`}
      aria-label="Last activity"
    >
      <p className={`min-w-0 flex-1 text-[var(--muted)] ${lineClamp}`}>
        <span className="text-[var(--muted)]">{formatLogTimestamp(entry.createdAt, timeZone)}</span>
        <span className="text-[var(--muted)]">: </span>
        <span className="text-[var(--fg)]/90">
          <LedgerLineDescription entry={entry} members={members} />
        </span>
      </p>
      {right}
    </div>
  );
}
