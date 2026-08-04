"use client";

import { nameInitials } from "@/lib/member-utils";
import type { PerformanceScorecardRow } from "@/lib/ledger-types";

export function MemberChipRow({
  members,
  selectedUserId,
  onSelect,
  onHover,
}: {
  members: PerformanceScorecardRow[];
  selectedUserId: string | null;
  onSelect: (userId: string) => void;
  /** Optional: warms that member's task-drill-down cache ahead of a click. */
  onHover?: (userId: string) => void;
}) {
  if (members.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No one in scope for this range yet.</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Team members">
      {members.map((m) => {
        const active = m.userId === selectedUserId;
        const needsAttention =
          m.late > 0 || m.submissionsFulfilled < m.submissionsRequired || m.attachmentsFulfilled < m.attachmentsRequired;
        return (
          <button
            key={m.userId}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(m.userId)}
            onMouseEnter={() => onHover?.(m.userId)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-elevated)] ${
              active
                ? "border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--fg)]"
                : "border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--fg)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            {needsAttention && (
              <span
                className="size-1.5 shrink-0 rounded-full bg-rose-500"
                title="Late completion or unmet compliance in this range"
                aria-hidden
              />
            )}
            {m.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.image} alt="" className="size-5 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-muted)] text-[9px] font-semibold text-[var(--fg)]">
                {nameInitials(m.name, m.email)}
              </span>
            )}
            <span className="max-w-[9rem] truncate">{m.name || m.email}</span>
            <span className="tabular-nums text-xs text-[var(--muted)]">{m.completed}</span>
          </button>
        );
      })}
    </div>
  );
}
