"use client";

import { useRef, useState } from "react";
import type { SubtaskRow } from "@/lib/ledger-types";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
      {children}
    </label>
  );
}

export function TaskSubtaskList({
  subtasks,
  disabled,
  error,
  onCreate,
  onUpdate,
  onDelete,
  getStableKey,
  toggleOnly,
}: {
  subtasks: SubtaskRow[];
  disabled?: boolean;
  isPending?: boolean;
  error?: string | null;
  onCreate: (title: string) => void;
  onUpdate: (vars: { subtaskId: string; title?: string; done?: boolean }) => void;
  onDelete: (subtaskId: string) => void;
  /** Keeps row identity when optimistic ids are replaced by server ids. */
  getStableKey?: (subtaskId: string) => string;
  /** Members without edit rights: done-toggle stays live, add/rename/remove are hidden. */
  toggleOnly?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingVal, setEditingVal] = useState("");
  const creatingRef = useRef(false);

  /** Cache already maintains display order; re-sorting here caused rows to jump while saving. */
  const ordered = subtasks;

  function commitDraft() {
    const title = draft.trim();
    if (!title || disabled || creatingRef.current) return;
    setDraft("");
    creatingRef.current = true;
    onCreate(title);
    queueMicrotask(() => {
      creatingRef.current = false;
    });
  }

  function commitEdit(id: string, original: string) {
    const next = editingVal.trim();
    setEditingId(null);
    if (!next || next === original) return;
    onUpdate({ subtaskId: id, title: next });
  }

  const doneCount = ordered.filter((s) => s.done).length;

  return (
    <div>
      <SectionLabel>
        {ordered.length > 0 ? `Subtasks — ${doneCount}/${ordered.length} done` : "Subtasks"}
      </SectionLabel>
      {error && (
        <p className="mb-2 text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      <div className="space-y-0.5">
        {ordered.map((item) => (
          <div
            key={getStableKey ? getStableKey(item.id) : item.id}
            className="group flex items-center gap-2.5 py-1.5"
          >
            <button
              type="button"
              disabled={disabled || item.id.startsWith("optimistic-")}
              className={`shrink-0 text-sm disabled:opacity-50 ${item.done ? "text-green-600 dark:text-green-400" : "text-[var(--muted)]"}`}
              onClick={() => onUpdate({ subtaskId: item.id, done: !item.done })}
              aria-label={item.done ? "Mark subtask incomplete" : "Mark subtask done"}
            >
              {item.done ? "✓" : "○"}
            </button>
            {!toggleOnly && editingId === item.id ? (
              <input
                autoFocus
                disabled={disabled}
                className="flex-1 bg-transparent text-sm text-[var(--fg)] outline-none"
                value={editingVal}
                onChange={(e) => setEditingVal(e.target.value)}
                onBlur={() => commitEdit(item.id, item.title)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitEdit(item.id, item.title);
                  }
                  if (e.key === "Escape") setEditingId(null);
                }}
              />
            ) : (
              <span
                className={`flex-1 text-sm ${toggleOnly ? "" : "cursor-text"} ${item.done ? "text-[var(--muted)] line-through" : "text-[var(--fg)]"}`}
                onClick={() => {
                  if (disabled || toggleOnly) return;
                  setEditingId(item.id);
                  setEditingVal(item.title);
                }}
              >
                {item.title}
              </span>
            )}
            {!toggleOnly && (
              <button
                type="button"
                disabled={disabled || item.id.startsWith("optimistic-")}
                className="shrink-0 text-xs text-[var(--muted)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500 disabled:opacity-50"
                onClick={() => onDelete(item.id)}
              >
                Remove
              </button>
            )}
          </div>
        ))}
        {!toggleOnly && (
          <div className="flex items-center gap-2.5 py-1.5">
            <span className="text-sm text-[var(--muted)]">+</span>
            <input
              disabled={disabled}
              className="flex-1 bg-transparent text-sm text-[var(--fg)] outline-none placeholder:text-[var(--muted)] disabled:opacity-50"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a subtask…"
              onBlur={commitDraft}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitDraft();
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
