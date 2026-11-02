"use client";

import Link from "next/link";
import { Fragment, type ReactNode } from "react";

/**
 * Renders an agent answer: paragraphs, `- ` and `1.` lists, `**bold**`, `inline code`, and `[Title](task:<id>)`
 * links to the task. Deliberately tiny — the prompt only asks for these; anything else shows as plain text.
 * Safe on a half-streamed answer: an unclosed `**` or link just stays literal until the rest arrives.
 */
export function AgentText({
  text,
  taskHref,
  onNavigate,
}: {
  text: string;
  taskHref: (taskId: string) => string;
  onNavigate?: () => void;
}) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className="space-y-2.5 break-words text-sm leading-relaxed text-[var(--fg)]">
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim());
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
