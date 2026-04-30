"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { MemberRow } from "@/lib/ledger-types";

function primaryLabel(m: MemberRow): string {
  return (m.name?.trim() || m.email || "").trim() || "Unknown";
}

function secondaryLine(m: MemberRow): string | null {
  const name = m.name?.trim();
  const email = (m.email || "").trim();
  if (name && email) return email;
  return null;
}

function matchesQuery(m: MemberRow, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return (m.name ?? "").toLowerCase().includes(s) || (m.email ?? "").toLowerCase().includes(s);
}

export type AssigneeSearchFieldProps = {
  members: MemberRow[];
  assigneeIds: string[];
  onToggleAssignee: (userId: string) => void;
};

export function AssigneeSearchField({ members, assigneeIds, onToggleAssignee }: AssigneeSearchFieldProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const uid = useId();
  const inputId = `${uid}-assignee-query`;
  const optionsId = `${uid}-assignee-options`;

  const available = useMemo(() => {
    return members
      .filter((m) => !assigneeIds.includes(m.userId))
      .filter((m) => matchesQuery(m, query))
      .sort((a, b) => primaryLabel(a).localeCompare(primaryLabel(b)));
  }, [members, assigneeIds, query]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const emptyListMessage =
    members.length === 0
      ? "No team members in this workspace."
      : assigneeIds.length > 0 && available.length === 0 && !query.trim()
        ? "All team members are already assigned."
        : "No matches · try another name or email.";

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-[var(--muted)]">Assignees</p>

      {assigneeIds.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {assigneeIds.map((id) => {
            const m = members.find((row) => row.userId === id);
            const main = m ? primaryLabel(m) : "Unknown member";
            const sub = m ? secondaryLine(m) : null;
            return (
              <span
                key={id}
                className="inline-flex max-w-full items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2.5 py-1 text-sm text-[var(--fg)]"
              >
                <span className="min-w-0 truncate" title={sub ?? main}>
                  {main}
                  {sub ? <span className="text-[var(--muted)]"> · {sub}</span> : null}
                </span>
                <button
                  type="button"
                  className="shrink-0 rounded px-1 text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
                  aria-label={`Remove ${main}`}
                  onClick={() => onToggleAssignee(id)}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      ) : null}

      <div ref={containerRef} className="relative">
        <label htmlFor={inputId} className="sr-only">
          Search assignees by name or email
        </label>
        <input
          id={inputId}
          type="search"
          autoComplete="off"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={optionsId}
          placeholder="Search name or email…"
          className="input w-full rounded-xl text-sm"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        />
        {open ? (
          <ul
            id={optionsId}
            role="listbox"
            aria-label="Team members"
            className="absolute z-[60] mt-1 max-h-52 w-full overflow-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] py-1 shadow-lg"
          >
            {available.length === 0 ? (
              <li className="px-3 py-2 text-sm text-[var(--muted)]">{emptyListMessage}</li>
            ) : (
              available.map((m) => {
                const extra = secondaryLine(m);
                return (
                  <li key={m.userId} role="presentation">
                    <button
                      type="button"
                      role="option"
                      className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-hover)]"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onToggleAssignee(m.userId);
                        setQuery("");
                      }}
                    >
                      <span className="font-medium text-[var(--fg)]">{primaryLabel(m)}</span>
                      {extra ? <span className="text-xs text-[var(--muted)]">{extra}</span> : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        ) : null}
      </div>
      <p className="text-[11px] text-[var(--muted)]">
        Pick from the list to assign. Already assigned people are hidden until removed.
      </p>
    </div>
  );
}
