"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faBell } from "@fortawesome/free-solid-svg-icons";
import { faDiscord } from "@fortawesome/free-brands-svg-icons";
import type { MemberRow } from "@/lib/ledger-types";
import { formatLogTimestamp } from "@/lib/task-activity-log";
import { formatInTimeZone } from "@/lib/date";
import { POP_EASE, motionDuration } from "@/components/ui/motion-presets";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { useApiSession } from "@/hooks/useApiSession";
import { useSeriesOccurrences, type SeriesSummaryRow } from "@/hooks/useWorkTaskStats";

type Props = {
  orgId: string;
  /** Header stats (count/latest/last completion) — the card only ever gets built from an entry in the already-loaded summary list, so this is never "still loading" from here. */
  summary: SeriesSummaryRow;
  /** Statuses this card's occurrence list should be fetched for once expanded (e.g. a single kanban column, or done+cancelled together in list view). */
  occurrenceStatuses: readonly string[];
  members: MemberRow[];
  onOpenTask: (taskId: string) => void;
};

/** Minimal shape the completion-line helpers need — satisfied by both a full TaskRow and a series-summary's `lastDone`. */
type CompletionLike = {
  completedAt?: string | null;
  dueAt: string | null;
  assigneeUserIds?: string[];
  lastSubmittedAt?: string | null;
};

function formatDate(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "—";
  return formatInTimeZone(new Date(iso), timeZone, { month: "short", day: "numeric", year: "numeric" });
}

function memberName(members: MemberRow[], userId: string): string {
  const m = members.find((x) => x.userId === userId);
  return m?.name?.trim() || m?.email || "Unknown";
}

function assigneeNames(members: MemberRow[], t: CompletionLike): string {
  return t.assigneeUserIds?.length ? t.assigneeUserIds.map((id) => memberName(members, id)).join(", ") : "Someone";
}

/** Late/on-time verdict for a completed occurrence; mirrors the label already sent to Discord on submission. */
function completionTiming(t: CompletionLike): { late: boolean } | null {
  if (!t.completedAt || !t.dueAt) return null;
  return { late: new Date(t.completedAt).getTime() > new Date(t.dueAt).getTime() };
}

/** "{completedAt}, {assignee} completed this task [icon] in time/late". */
function CompletionLine({ t, members, timeZone }: { t: CompletionLike; members: MemberRow[]; timeZone: string }) {
  if (!t.completedAt) return null;
  const timing = completionTiming(t);
  return (
    <span>
      {formatLogTimestamp(t.completedAt, timeZone)}, {assigneeNames(members, t)} completed this task
      {timing && (
        <>
          {" "}
          <FontAwesomeIcon
            icon={timing.late ? faBell : faCheck}
            className={`h-[0.7em] w-[0.7em] align-[1px] ${
              timing.late ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
            }`}
          />{" "}
          {timing.late ? "late" : "in time"}
        </>
      )}
    </span>
  );
}

/** "Sent to [discord logo] Discord · {timestamp}", pill-chipped like the recurring badge. */
function DiscordSubmissionLine({ t, timeZone }: { t: CompletionLike; timeZone: string }) {
  if (!t.lastSubmittedAt) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-hover)] px-1.5 py-0.5">
      Sent to <FontAwesomeIcon icon={faDiscord} className="h-[0.7em] w-[0.7em] text-[#5865F2]" /> Discord
      <span className="text-[var(--muted)]/50">·</span>
      {formatLogTimestamp(t.lastSubmittedAt, timeZone)}
    </span>
  );
}

function OccurrenceListSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-3 py-2" aria-hidden>
      <div className="h-2.5 w-3/4 animate-pulse rounded bg-[var(--surface-hover)]" />
      <div className="h-2.5 w-1/2 animate-pulse rounded bg-[var(--surface-hover)]" />
      <div className="h-2.5 w-2/3 animate-pulse rounded bg-[var(--surface-hover)]" />
    </div>
  );
}

/**
 * Groups a recurring chain into a single collapsible card (Done/Cancelled columns). Header stats
 * are passed in straight from the already-loaded summary list — the card is only ever constructed
 * from one of those entries, so there's no separate "loading" state to show here (and no skeleton
 * to flash in and swap the header's height once it's already showing real content). Only the full
 * occurrence list is fetched on demand — with its own loading state — once the card is expanded.
 */
export function RecurringSeriesCard({ orgId, summary, occurrenceStatuses, members, onOpenTask }: Props) {
  const [expanded, setExpanded] = useState(false);
  const prefersReduced = useReducedMotion();
  const { timeZone } = useWorkspaceRoute();
  const { token } = useApiSession();

  const { tasks: occurrences, isLoading: occurrencesLoading } = useSeriesOccurrences(token, orgId, summary.seriesId, {
    statuses: occurrenceStatuses,
    enabled: expanded,
  });

  return (
    <li className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] overflow-hidden">
      {/* Series header row */}
      <div className="flex items-start gap-2.5 px-3 pt-3 pb-2">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onOpenTask(summary.latest.id)}
            className="text-left text-sm font-medium leading-snug text-[var(--fg)] hover:underline line-clamp-2"
          >
            {summary.latest.title}
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono-ledger text-[10px] text-[var(--muted)]">
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-hover)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
              <svg width="8" height="8" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.75 3.75a.75.75 0 0 0-1.5 0v3.5l2.25 2.25a.75.75 0 1 0 1.06-1.06L8.75 7.69V4.75z"/>
              </svg>
              Recurring · {summary.count} {summary.count === 1 ? "completion" : "completions"}
            </span>
            {summary.lastDone?.completedAt ? (
              <span>
                <CompletionLine t={summary.lastDone} members={members} timeZone={timeZone} />
              </span>
            ) : summary.lastDone ? (
              <span>Last: {formatDate(summary.lastDone.dueAt, timeZone)}</span>
            ) : null}
            {summary.lastDone?.lastSubmittedAt && (
              <DiscordSubmissionLine t={summary.lastDone} timeZone={timeZone} />
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

      {/* Occurrence list — fetched on demand, only while expanded */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            className="border-t border-[var(--border-subtle)]/50"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
            exit={{ height: 0, opacity: 0, overflow: "hidden" }}
            transition={{ duration: motionDuration(0.2, prefersReduced), ease: POP_EASE }}
            style={{ overflow: "hidden" }}
          >
            {occurrencesLoading ? (
              <OccurrenceListSkeleton />
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]/30">
                {occurrences.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 px-3 py-2">
                    <span className="min-w-0 flex-1 font-mono-ledger text-[11px] text-[var(--muted)]">
                      {t.completedAt ? (
                        <>
                          <CompletionLine t={t} members={members} timeZone={timeZone} />
                          {t.lastSubmittedAt && (
                            <span className="ml-1.5">
                              <DiscordSubmissionLine t={t} timeZone={timeZone} />
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          Due {formatDate(t.dueAt, timeZone)}
                          {t.assigneeUserIds?.length ? (
                            <span className="ml-1.5 text-[var(--fg)]/70">
                              {t.assigneeUserIds.map((id) => memberName(members, id)).join(", ")}
                            </span>
                          ) : null}
                        </>
                      )}
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
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
