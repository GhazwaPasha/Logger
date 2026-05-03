"use client";

import type { LedgerRow, MemberRow } from "@/lib/ledger-types";
import { LedgerLineDescription } from "@/components/tasks/LedgerLineDescription";
import { formatLogTimestamp } from "@/lib/task-activity-log";

type Props = {
  entry: LedgerRow;
  members: MemberRow[];
  /** Tighter line clamp for dense kanban columns */
  compact?: boolean;
  /**
   * `inline` — dense preview without footer chrome (rare; list/kanban use `footer`).
   * `footer` — card footer with border-top separator (default; list + kanban).
   */
  variant?: "inline" | "footer";
};

/** Ledger preview for list (under title) or kanban (card footer). */
export function TaskCardLastActivity({ entry, members, compact, variant = "footer" }: Props) {
  const lineClamp = compact ? "line-clamp-2" : variant === "inline" ? "line-clamp-2" : "line-clamp-3";

  if (variant === "inline") {
    return (
      <div className="min-w-0 font-mono-ledger text-[11px] leading-snug" aria-label="Last activity">
        <p className={`min-w-0 text-[var(--muted)] ${lineClamp}`}>
          <span className="text-[var(--muted)]">{formatLogTimestamp(entry.createdAt)}</span>
          <span className="text-[var(--muted)]">: </span>
          <span className="text-[var(--fg)]/90">
            <LedgerLineDescription entry={entry} members={members} />
          </span>
        </p>
      </div>
    );
  }

  return (
    <div
      className={`border-t border-[var(--border-subtle)]/50 pt-2 ${compact ? "px-3 pb-2.5" : "px-4 pb-3"} font-mono-ledger text-[11px] leading-snug`}
      aria-label="Last activity"
    >
      <p className={`min-w-0 text-[var(--muted)] ${lineClamp}`}>
        <span className="text-[var(--muted)]">{formatLogTimestamp(entry.createdAt)}</span>
        <span className="text-[var(--muted)]">: </span>
        <span className="text-[var(--fg)]/90">
          <LedgerLineDescription entry={entry} members={members} />
        </span>
      </p>
    </div>
  );
}
