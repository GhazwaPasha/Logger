"use client";

import { useId, useEffect, useRef, useState } from "react";

import type { LedgerRow, MemberRow, TaskRow } from "@/lib/ledger-types";
import { LedgerLineDescription, ledgerLogUserClassName } from "@/components/tasks/LedgerLineDescription";

import { formatCreatorDisplay, formatLogTimestamp, isTaskCreatedNote, memberDisplayName } from "@/lib/task-activity-log";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { Collapse } from "@/components/ui/Collapse";

/** Collapsed → right; expanded → down (same affordance as list rows on the work board). */
function IconChevronDisclosure({ className, open }: { className?: string; open: boolean }) {
  return (
    <svg
      className={`${className ?? ""} shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

type Props = {
  task: TaskRow;
  ledger: LedgerRow[];
  members: MemberRow[];
  /** Extra classes for the card's outer box (e.g. top margin where the parent has no gap). */
  className?: string;
};

export function TaskPanelHistoryCard({ task, ledger, members, className }: Props) {
  const { timeZone } = useWorkspaceRoute();
  const [expanded, setExpanded] = useState(false);
  const headingId = useId();
  const regionId = useId();
  const bottomRef = useRef<HTMLDivElement>(null);

  const creatorName = formatCreatorDisplay(memberDisplayName(members, task.assignerId));
  const entriesOldestFirst = ledger.filter((e) => !isTaskCreatedNote(e)).slice().reverse();

  useEffect(() => {
    if (expanded) {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [expanded, ledger.length]);

  return (
    <div className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)]/40 px-4 py-3 ${className ?? ""}`}>
      <button
        type="button"
        id={headingId}
        className="flex w-full items-center justify-between gap-2 rounded-lg py-0.5 text-left outline-none ring-[var(--focus-ring)] ring-offset-2 ring-offset-[var(--surface-elevated)] focus-visible:ring-2"
        aria-expanded={expanded}
        aria-controls={regionId}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-xs font-semibold text-[var(--muted)]">History</span>
        <IconChevronDisclosure open={expanded} className="text-[var(--muted)]" />
      </button>
      <Collapse open={expanded} id={regionId} role="region" aria-labelledby={headingId}>
            <div
              className="mt-3 space-y-2 font-mono-ledger text-[12px] leading-snug text-[var(--fg)]"
              aria-label="Task activity log"
            >
              <p className="break-words">
                <span className={ledgerLogUserClassName}>{creatorName}</span>
                <span className="text-[var(--muted)]"> created this task · </span>
                <span className="break-all text-[var(--muted)]">{task.id}</span>
              </p>
              {entriesOldestFirst.map((entry) => (
                <p key={entry.id}>
                  <span className="text-[var(--muted)]">{formatLogTimestamp(entry.createdAt, timeZone)}</span>
                  <span className="text-[var(--muted)]">: </span>
                  <span>
                    <LedgerLineDescription entry={entry} members={members} taskDueAt={task.dueAt} />
                  </span>
                </p>
              ))}
              <div ref={bottomRef} />
            </div>
          </Collapse>
    </div>
  );
}
