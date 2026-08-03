"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { LoadingLinesBlock } from "@/components/ui/LoadingFrame";
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
  /** Tailwind max-height class for the scrollable log list. */
  maxHeightClassName?: string;
};

const DEFAULT_MAX_HEIGHT_CLASSNAME = "max-h-[min(55vh,26rem)]";

/** An entry younger than this "types in" live; older ones render already-settled. */
const LIVE_ENTRY_WINDOW_MS = 2 * 60 * 1000;

/** Rotating status phrases for the standing "watching" line — same meaning, different words each beat. */
const PULSE_WORDS = [
  "Watching for activity",
  "Listening for updates",
  "Keeping watch",
  "Tracking changes",
  "Standing by",
  "Syncing the ledger",
];

const PULSE_WORD_INTERVAL_MS = 2400;

/** Always-on status row pinned to the top of the log — spinning glyph + rotating phrase, cursor at the end. */
function TerminalPulseLine() {
  const [wordIndex, setWordIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setWordIndex((i) => (i + 1) % PULSE_WORDS.length);
    }, PULSE_WORD_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <p className="activity-terminal-line flex items-center gap-1.5 text-[var(--term-muted)]">
      <span className="activity-terminal-pulse-glyph" aria-hidden>
        ✳
      </span>
      <span key={wordIndex} className="activity-terminal-pulse-word">
        {PULSE_WORDS[wordIndex]}…
      </span>
      <span className="activity-terminal-cursor" aria-hidden />
    </p>
  );
}

function TerminalChrome({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="activity-terminal" aria-label="Organization activity log">
      <div className="activity-terminal__bar">
        <div className="activity-terminal__title">
          <span>{label}</span>
        </div>
      </div>
      <div className="activity-terminal__body">
        <div className="activity-terminal__scanlines" aria-hidden />
        {children}
      </div>
    </div>
  );
}

export function OrgActivityTerminal({
  entries,
  tasksById,
  members,
  workHrefBase,
  isLoading,
  errorMessage,
  maxHeightClassName = DEFAULT_MAX_HEIGHT_CLASSNAME,
}: Props) {
  const { timeZone } = useWorkspaceRoute();
  // Snapshot "now" after mount (not during render) so recency checks stay pure;
  // re-snapshots whenever entries change so freshly-arrived rows get the type-in animation.
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
  }, [entries]);

  if (errorMessage) {
    return (
      <TerminalChrome label="activity.log">
        <p className="px-4 py-3 text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
      </TerminalChrome>
    );
  }

  if (isLoading) {
    return (
      <TerminalChrome label="activity.log">
        <LoadingLinesBlock lines={7} className="p-4 font-mono-ledger opacity-70" />
      </TerminalChrome>
    );
  }

  if (entries.length === 0) {
    return (
      <TerminalChrome label="activity.log">
        <div className="space-y-2 p-3 font-mono-ledger text-[12px] leading-snug">
          <TerminalPulseLine />
          <p className="text-sm text-[var(--term-muted)]">
            No activity logged yet for tasks you can access in this workspace.
          </p>
        </div>
      </TerminalChrome>
    );
  }

  return (
    <TerminalChrome label="activity.log">
      <div
        className={`scrollbar-hide ${maxHeightClassName} overflow-y-auto overflow-x-hidden overscroll-contain p-3 font-mono-ledger text-[12px] leading-snug`}
      >
        <div className="space-y-2">
          <TerminalPulseLine />
          {entries.map((entry) => {
            const meta = tasksById[entry.taskId];
            const title = meta?.title ?? entry.taskId;
            const taskLink = `${workHrefBase}/work?task=${encodeURIComponent(entry.taskId)}`;
            const isLive = now - new Date(entry.createdAt).getTime() < LIVE_ENTRY_WINDOW_MS;
            return (
              <p
                key={entry.id}
                className={`activity-terminal-line break-words${isLive ? " activity-terminal-line--enter" : ""}`}
              >
                <span className="text-[var(--term-muted)]">{formatLogTimestamp(entry.createdAt, timeZone)}</span>
                <span className="text-[var(--term-muted)]">: </span>
                <Link href={taskLink} className="font-bold text-[var(--term-fg)] hover:text-[var(--term-live)]">
                  {title}
                </Link>
                <span className="text-[var(--term-muted)]"> · </span>
                <span>
                  <LedgerLineDescription entry={entry} members={members} taskDueAt={meta?.dueAt ?? null} />
                </span>
              </p>
            );
          })}
        </div>
      </div>
    </TerminalChrome>
  );
}
