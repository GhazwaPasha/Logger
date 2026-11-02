"use client";

import Link from "next/link";
import { Fragment, useState, type ReactNode } from "react";

/**
 * Renders an agent answer: paragraphs, `- ` and `1.` lists, `**bold**`, `inline code`, and `[Title](task:<id>)`
 * links to the task. Deliberately tiny — the prompt only asks for these; anything else shows as plain text.
 * Safe on a half-streamed answer: an unclosed `**` or link just stays literal until the rest arrives.
 */
export function AgentText({
  text,
  taskHref,
  taskInfo,
  onNavigate,
}: {
  text: string;
  taskHref: (taskId: string) => string;
  /** Live board data for a task, so a list of tasks renders as the app's own mini cards, not plain links. */
  taskInfo?: (taskId: string) => TaskCardInfo | null;
  onNavigate?: () => void;
}) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className="space-y-2.5 break-words text-sm leading-relaxed text-[var(--fg)]">
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim());
        const asList = lines.length > 0 && (lines.every((l) => BULLET_RE.test(l)) || lines.every((l) => NUMBERED_RE.test(l)));
        // A list where every item leads with a task link is a list *of tasks*: show cards.
        const items = asList ? lines.map((l) => l.replace(BULLET_RE, "").replace(NUMBERED_RE, "")) : [];
        const leads = items.map((it) => LEADING_TASK_RE.exec(it));
        if (taskInfo && asList && leads.every(Boolean)) {
          return (
            <div key={i} className="space-y-1.5">
              {leads.map((m, j) => (
                <TaskMiniCard
                  key={j}
                  href={taskHref(m![2]!)}
                  fallbackTitle={m![1]!}
                  info={taskInfo(m![2]!)}
                  note={m![3]!.replace(/^\s*[—–:-]\s*/, "").trim()}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          );
        }
        if (lines.length > 0 && lines.every((l) => BULLET_RE.test(l))) {
          return (
            <ul key={i} className="space-y-1 pl-4">
              {lines.map((l, j) => (
                <li key={j} className="list-disc pl-0.5 marker:text-[var(--muted)]">
                  {inline(l.replace(BULLET_RE, ""), taskHref, onNavigate)}
                </li>
              ))}
            </ul>
          );
        }
        if (lines.length > 0 && lines.every((l) => NUMBERED_RE.test(l))) {
          return (
            <ol key={i} className="space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j} className="list-decimal pl-0.5 marker:text-[var(--muted)]">
                  {inline(l.replace(NUMBERED_RE, ""), taskHref, onNavigate)}
                </li>
              ))}
            </ol>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l.replace(/^#{1,6}\s+/, "").replace(BULLET_RE, "• "), taskHref, onNavigate)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

const BULLET_RE = /^\s*[-*•]\s+/;
const NUMBERED_RE = /^\s*\d+[.)]\s+/;
const LEADING_TASK_RE = /^\s*(?:\*\*)?\[([^\]]+)\]\(task:([0-9a-f-]{36})\)(?:\*\*)?(.*)$/;

export type TaskCardInfo = {
  title: string;
  status: string;
  dueAt: string | null;
  assignee: string | null;
  assigneeImage: string | null;
};

const STATUS_TONE: Record<string, string> = {
  pending: "bg-[var(--muted)]",
  open: "bg-[var(--muted)]",
  assigned: "bg-[var(--muted)]",
  in_progress: "bg-violet-400",
  late: "bg-violet-400",
  done: "bg-emerald-500",
  cancelled: "bg-[var(--border)]",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  open: "Pending",
  assigned: "Pending",
  in_progress: "In progress",
  late: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

/** One task from an answer, drawn like a compact board card: status dot, title, due, assignee. */
function TaskMiniCard({
  href,
  fallbackTitle,
  info,
  note,
  onNavigate,
}: {
  href: string;
  fallbackTitle: string;
  info: TaskCardInfo | null;
  note: string;
  onNavigate?: () => void;
}) {
  // "Now" as of when the card appeared; an answer is a snapshot, so it needn't tick.
  const [now] = useState(() => Date.now());
  const overdue =
    !!info?.dueAt && new Date(info.dueAt).getTime() < now && info.status !== "done" && info.status !== "cancelled";
  const due = info?.dueAt
    ? new Date(info.dueAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="group/mini flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-2 transition-[border-color,transform] duration-150 hover:-translate-y-px hover:border-[var(--border)]"
    >
      <span
        className={`size-2 shrink-0 rounded-full ${STATUS_TONE[info?.status ?? ""] ?? "bg-[var(--border)]"}`}
        title={info ? STATUS_LABEL[info.status] ?? info.status : undefined}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-[var(--fg)]">{info?.title ?? fallbackTitle}</span>
        {(note || due) && (
          <span className="block truncate text-[11px] text-[var(--muted)]">
            {due && <span className={overdue ? "text-red-500 dark:text-red-400" : undefined}>{overdue ? `Overdue · ${due}` : due}</span>}
            {due && note ? " · " : null}
            {note}
          </span>
        )}
      </span>
      {info?.assignee && (
        <span
          className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent-muted)] text-[9px] font-semibold uppercase text-[var(--fg)]"
          title={info.assignee}
        >
          {info.assigneeImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- tiny avatar from the member list, same as elsewhere
            <img src={info.assigneeImage} alt="" className="size-full object-cover" />
          ) : (
            info.assignee.charAt(0)
          )}
        </span>
      )}
    </Link>
  );
}
const TOKEN_RE = /\[([^\]]+)\]\(task:([0-9a-f-]{36})\)|\*\*([^*]+)\*\*|`([^`]+)`/g;

function inline(line: string, taskHref: (taskId: string) => string, onNavigate?: () => void): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of line.matchAll(TOKEN_RE)) {
    if (m.index! > last) out.push(line.slice(last, m.index));
    if (m[2]) {
      out.push(
        <Link
          key={m.index}
          href={taskHref(m[2])}
          onClick={onNavigate}
          className="font-medium text-[var(--fg)] underline decoration-[var(--border)] decoration-1 underline-offset-[3px] transition-colors hover:decoration-[var(--fg)]"
        >
          {m[1]}
        </Link>,
      );
    } else if (m[3]) {
      out.push(
        <strong key={m.index} className="font-semibold">
          {m[3]}
        </strong>,
      );
    } else {
      out.push(
        <code key={m.index} className="rounded bg-[var(--surface-elevated)] px-1 py-px font-mono text-[12px]">
          {m[4]}
        </code>,
      );
    }
    last = m.index! + m[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}
