"use client";

import Link from "next/link";
import { LoadingFrame, LoadingLinesBlock } from "@/components/ui/LoadingFrame";
import { LedgerLineDescription } from "@/components/tasks/LedgerLineDescription";
import type { MemberRow, OrgActivityLedgerRow, OrgActivityTaskMeta } from "@/lib/ledger-types";
import { formatLogTimestamp } from "@/lib/task-activity-log";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";

type Props = {
  entries: OrgActivityLedgerRow[];
  tasksById: Record<string, OrgActivityTaskMeta>;
  members: MemberRow[];
  workHrefBase: string;
  isLoading: boolean;
  errorMessage: string | null;
};

export function OrgActivityTerminal({
  entries,
  tasksById,
  members,
  workHrefBase,
  isLoading,
  errorMessage,
}: Props) {
  const { timeZone } = useWorkspaceRoute();
  if (errorMessage) {
    return <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>;
  }

  if (isLoading) {
    return (
      <LoadingFrame
        show
        className="min-h-[min(55vh,26rem)] rounded-xl border border-[var(--border-subtle)] p-4"
        aria-label="Loading activity log"
      >
        <LoadingLinesBlock lines={7} className="pt-1 font-mono-ledger" />
      </LoadingFrame>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        No activity logged yet for tasks you can access in this workspace.
      </p>
    );
  }

  return (
    <div
      className="scrollbar-hide max-h-[min(55vh,26rem)] overflow-y-auto overflow-x-hidden overscroll-contain pr-1 font-mono-ledger text-[12px] leading-snug text-[var(--fg)]"
      aria-label="Organization activity log"
    >
      <div className="space-y-2">
        {entries.map((entry) => {
          const meta = tasksById[entry.taskId];
          const title = meta?.title ?? entry.taskId;
          const taskLink = `${workHrefBase}/work?task=${encodeURIComponent(entry.taskId)}`;
          return (
            <p key={entry.id} className="break-words">
              <span className="text-[var(--muted)]">{formatLogTimestamp(entry.createdAt, timeZone)}</span>
              <span className="text-[var(--muted)]">: </span>
              <Link
                href={taskLink}
                className="text-[var(--fg)] underline decoration-[var(--border-subtle)] underline-offset-2 hover:decoration-[var(--fg)]"
              >
                {title}
              </Link>
              <span className="text-[var(--muted)]"> · </span>
              <span>
              <LedgerLineDescription entry={entry} members={members} taskDueAt={meta?.dueAt ?? null} />
            </span>
            </p>
          );
        })}
      </div>
    </div>
  );
}
