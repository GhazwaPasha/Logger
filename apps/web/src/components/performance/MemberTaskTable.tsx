"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRepeat } from "@fortawesome/free-solid-svg-icons";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { LoadingLinesBlock } from "@/components/ui/LoadingFrame";
import {
  normalizeTaskStatus,
  PRIORITY_LABELS,
  statusPillPaletteClasses,
  taskStatusDisplayLabel,
  type TaskPriority,
} from "@/lib/task-board";
import type { MemberTaskRow } from "@/lib/ledger-types";

type SortKey = "title" | "status" | "dueAt" | "completedAt" | "timeLoggedSeconds";

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "title", label: "Task" },
  { key: "status", label: "Status" },
  { key: "dueAt", label: "Due" },
  { key: "completedAt", label: "Completed" },
  { key: "timeLoggedSeconds", label: "Time", align: "right" },
];

function formatShortDate(iso: string | null, timeZone: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  }).format(d);
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  if (hrs === 0) return `${mins}m`;
  return mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`;
}

function Chip({ label, tone }: { label: string; tone: "ok" | "bad" | "neutral" }) {
  const toneClass =
    tone === "ok"
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
      : tone === "bad"
        ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
        : "bg-sky-500/15 text-sky-600 dark:text-sky-400";
  return (
    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none ${toneClass}`}>
      {label}
    </span>
  );
}

function ComplianceCell({ task }: { task: MemberTaskRow }) {
  const chips: { key: string; label: string; tone: "ok" | "bad" | "neutral" }[] = [];

  if (task.occurrenceCount != null && task.occurrenceCount > 1) {
    // Collection row — show ratios across all merged occurrences instead of a single fulfilled/missing tag.
    if (task.submissionsRequiredCount != null) {
      const ok = task.submissionsFulfilledCount === task.submissionsRequiredCount;
      chips.push({
        key: "submission",
        label: `Submitted ${task.submissionsFulfilledCount}/${task.submissionsRequiredCount}`,
        tone: ok ? "ok" : "bad",
      });
    }
    if (task.attachmentsRequiredCount != null) {
      const ok = task.attachmentsFulfilledCount === task.attachmentsRequiredCount;
      chips.push({
        key: "attachment",
        label: `Attached ${task.attachmentsFulfilledCount}/${task.attachmentsRequiredCount}`,
        tone: ok ? "ok" : "bad",
      });
    }
  } else {
    if (task.discordChannelId && task.discordSubmissionRequired) {
      chips.push({
        key: "submission",
        label: task.lastSubmittedAt ? "Submitted" : "Missing",
        tone: task.lastSubmittedAt ? "ok" : "bad",
      });
    } else if (task.discordChannelId && !task.discordSubmissionRequired) {
      chips.push({
        key: "submission-optional",
        label: task.lastSubmittedAt ? "Submitted" : "Optional",
        tone: "neutral",
      });
    }
    if (task.attachmentRequired) {
      chips.push({
        key: "attachment",
        label: task.hasAttachment ? "Attached" : "No attachment",
        tone: task.hasAttachment ? "ok" : "bad",
      });
    }
  }

  if (chips.length === 0) return <span className="text-[var(--muted)]">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((c) => (
        <Chip key={c.key} label={c.label} tone={c.tone} />
      ))}
    </div>
  );
}

function priorityDotClass(p: string | undefined): string {
  const pr = (p ?? "medium") as TaskPriority;
  if (pr === "high") return "bg-rose-500";
  if (pr === "low") return "bg-slate-400";
  return "bg-amber-500";
}

export function MemberTaskTable({
  tasks,
  loading,
  workHrefBase,
}: {
  tasks: MemberTaskRow[];
  loading: boolean;
  workHrefBase: string;
}) {
  const { timeZone } = useWorkspaceRoute();
  const [sortKey, setSortKey] = useState<SortKey>("dueAt");
  const [sortDesc, setSortDesc] = useState(false);

  const sorted = useMemo(() => {
    const rows = [...tasks];
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "title") cmp = a.title.localeCompare(b.title);
      else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
      else if (sortKey === "timeLoggedSeconds") cmp = a.timeLoggedSeconds - b.timeLoggedSeconds;
      else {
        const av = a[sortKey] ? new Date(a[sortKey]!).getTime() : Number.POSITIVE_INFINITY;
        const bv = b[sortKey] ? new Date(b[sortKey]!).getTime() : Number.POSITIVE_INFINITY;
        cmp = av - bv;
      }
      return sortDesc ? -cmp : cmp;
    });
    return rows;
  }, [tasks, sortKey, sortDesc]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDesc((d) => !d);
    } else {
      setSortKey(key);
      setSortDesc(false);
    }
  }

  if (loading) {
    return <LoadingLinesBlock lines={4} className="mt-2" />;
  }

  if (tasks.length === 0) {
    return <p className="mt-1 text-xs text-[var(--muted)]">No tasks completed or open in this range.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[38rem] border-collapse text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--muted)]">
            {COLUMNS.map((col) => (
              <th key={col.key} className={`pb-1.5 pr-2 font-medium ${col.align === "right" ? "text-right" : ""}`}>
                <button
                  type="button"
                  onClick={() => toggleSort(col.key)}
                  className={`inline-flex items-center gap-1 tabular-nums text-[var(--muted)] hover:text-[var(--fg)] ${
                    col.align === "right" ? "flex-row-reverse" : ""
                  }`}
                >
                  {col.label}
                  {sortKey === col.key ? <span aria-hidden>{sortDesc ? "↓" : "↑"}</span> : null}
                </button>
              </th>
            ))}
            <th className="pb-1.5 pl-2 font-medium">Compliance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {sorted.map((t) => {
            const st = normalizeTaskStatus(t.status);
            const overdue = !t.completedAt && t.dueAt != null && new Date(t.dueAt).getTime() < Date.now();
            return (
              <tr key={t.id}>
                <td className="max-w-[16rem] py-1.5 pr-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span
                      className={`size-1.5 shrink-0 rounded-full ${priorityDotClass(t.priority)}`}
                      title={`${PRIORITY_LABELS[(t.priority as TaskPriority) ?? "medium"] ?? "Medium"} priority`}
                      aria-hidden
                    />
                    {t.occurrenceCount != null && t.occurrenceCount > 1 ? (
                      <span
                        className="min-w-0 truncate text-[var(--fg)]"
                        title={`${t.title} — ${t.occurrenceCount} completed occurrences in range`}
                      >
                        {t.title}
                      </span>
                    ) : (
                      <Link
                        href={`${workHrefBase}/work?task=${encodeURIComponent(t.id)}`}
                        className="min-w-0 truncate text-[var(--fg)] underline decoration-[var(--border-subtle)] underline-offset-2 hover:decoration-[var(--fg)]"
                        title={t.title}
                      >
                        {t.title}
                      </Link>
                    )}
                    {t.occurrenceCount != null && t.occurrenceCount > 1 && (
                      <span
                        className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[var(--surface-hover)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted)]"
                        title="Recurring task — completed occurrences grouped together"
                      >
                        <FontAwesomeIcon icon={faRepeat} className="size-2.5" aria-hidden />
                        ×{t.occurrenceCount}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-1.5 pr-2">
                  <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusPillPaletteClasses(st)}`}>
                    {taskStatusDisplayLabel(st)}
                  </span>
                </td>
                <td className={`py-1.5 pr-2 tabular-nums ${overdue ? "text-rose-600 dark:text-rose-400" : "text-[var(--fg)]"}`}>
                  {formatShortDate(t.dueAt, timeZone)}
                </td>
                <td className="py-1.5 pr-2 tabular-nums">
                  <div className="flex items-center gap-1">
                    <span className={t.late ? "text-rose-600 dark:text-rose-400" : "text-[var(--fg)]"}>
                      {formatShortDate(t.completedAt, timeZone)}
                    </span>
                    {t.occurrenceCount != null && t.occurrenceCount > 1 ? (
                      t.lateCount ? <Chip label={`${t.lateCount} late`} tone="bad" /> : null
                    ) : t.late ? (
                      <Chip label="Late" tone="bad" />
                    ) : null}
                  </div>
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-[var(--fg)]">
                  {formatDuration(t.timeLoggedSeconds)}
                </td>
                <td className="py-1.5 pl-2">
                  <ComplianceCell task={t} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
