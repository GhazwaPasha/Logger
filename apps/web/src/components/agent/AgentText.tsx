"use client";

import Link from "next/link";
import { Fragment, type ReactNode } from "react";

/**
 * Renders an agent answer: paragraphs, `- ` bullet lists, `**bold**`, and `[Title](task:<id>)` links to the
 * task. Deliberately tiny — the prompt only allows these, and anything else shows as plain text.
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
    <div className="space-y-2.5 text-sm leading-relaxed text-[var(--fg)]">
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim());
        const isList = lines.length > 0 && lines.every((l) => /^\s*[-*•]\s+/.test(l));
        if (isList) {
          return (
            <ul key={i} className="space-y-1 pl-4">
              {lines.map((l, j) => (
                <li key={j} className="list-disc marker:text-[var(--muted)]">
                  {inline(l.replace(/^\s*[-*•]\s+/, ""), taskHref, onNavigate)}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l.replace(/^\s*[-*•]\s+/, "• "), taskHref, onNavigate)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

const TOKEN_RE = /\[([^\]]+)\]\(task:([0-9a-f-]{36})\)|\*\*([^*]+)\*\*/g;

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
          className="font-medium text-[var(--fg)] underline decoration-[var(--border)] underline-offset-[3px] transition-colors hover:decoration-[var(--fg)]"
        >
          {m[1]}
        </Link>,
      );
    } else {
      out.push(
        <strong key={m.index} className="font-semibold">
          {m[3]}
        </strong>,
      );
    }
    last = m.index! + m[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}
