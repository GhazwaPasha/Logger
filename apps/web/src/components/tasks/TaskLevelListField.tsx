"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Dept, ListRow } from "@/lib/ledger-types";
import { NODE_LABELS } from "@/lib/nodes";
import { POP_EASE, motionDuration, panelPopVariants } from "@/components/ui/motion-presets";

/** Level / department chip — quieter label color than the list chip. */
const LEVEL_CHIP_CLASS =
  "inline-flex max-w-full items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2.5 py-1 text-sm text-[var(--muted)]";

/** List chip — same shell, full-strength label color. */
const LIST_CHIP_CLASS =
  "inline-flex max-w-full items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2.5 py-1 text-sm text-[var(--fg)]";

function matchesQuery(name: string, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return name.toLowerCase().includes(s);
}

type Mode = "idle" | "picking-level" | "picking-list";

/**
 * Two-step search field: empty search button until a level is picked (becomes a chip), then a
 * scoped list search until a list is picked (becomes a second chip). Removing the list chip
 * re-opens the list search scoped to the same level; removing the level chip restarts from
 * scratch since a list can't exist without a level.
 */
export function TaskLevelListField({
  listId,
  lists,
  depts,
  canEdit,
  onChange,
}: {
  listId: string;
  lists: ListRow[];
  depts: Dept[];
  canEdit: boolean;
  onChange: (listId: string) => void;
}) {
  const committedList = lists.find((l) => l.id === listId) ?? null;
  const committedDept = committedList ? (depts.find((d) => d.id === committedList.departmentId) ?? null) : null;

  const [mode, setMode] = useState<Mode>("idle");
  const [stagedDeptId, setStagedDeptId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const uid = useId();
  const inputId = `${uid}-level-list-query`;
  const optionsId = `${uid}-level-list-options`;
  const prefersReduced = useReducedMotion();

  const cancel = () => {
    setMode("idle");
    setStagedDeptId(null);
    setQuery("");
  };

  useEffect(() => {
    if (mode === "idle") return;
    function onDoc(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) cancel();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [mode]);

  useEffect(() => {
    if (mode !== "idle") inputRef.current?.focus();
  }, [mode]);

  const deptOptions = useMemo(
    () => depts.filter((d) => matchesQuery(d.name, query)).sort((a, b) => a.name.localeCompare(b.name)),
    [depts, query],
  );

  const listOptions = useMemo(
    () =>
      lists
        .filter((l) => l.departmentId === stagedDeptId)
        .filter((l) => matchesQuery(l.name, query))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [lists, stagedDeptId, query],
  );

  if (!canEdit) {
    if (!committedDept && !committedList) return null;
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {committedDept ? (
          <span className={LEVEL_CHIP_CLASS} title={`${NODE_LABELS.level}: ${committedDept.name}`}>
            {committedDept.name}
          </span>
        ) : null}
        {committedList ? (
          <span className={LIST_CHIP_CLASS} title={`${NODE_LABELS.list}: ${committedList.name}`}>
            {committedList.name}
          </span>
        ) : null}
      </div>
    );
  }

  const stagedDept = stagedDeptId ? (depts.find((d) => d.id === stagedDeptId) ?? null) : null;

  return (
    <div ref={containerRef} className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {mode === "idle" && committedDept ? (
          <span className={LEVEL_CHIP_CLASS}>
            <span className="min-w-0 truncate">{committedDept.name}</span>
            <button
              type="button"
              className="shrink-0 rounded px-1 text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
              aria-label={`Change ${NODE_LABELS.level}`}
              onClick={() => setMode("picking-level")}
            >
              ×
            </button>
          </span>
        ) : null}

        {mode === "idle" && committedList ? (
          <span className={LIST_CHIP_CLASS}>
            <span className="min-w-0 truncate">{committedList.name}</span>
            <button
              type="button"
              className="shrink-0 rounded px-1 text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
              aria-label={`Change ${NODE_LABELS.list}`}
              onClick={() => {
                setStagedDeptId(committedDept?.id ?? null);
                setMode("picking-list");
              }}
            >
              ×
            </button>
          </span>
        ) : null}

        {mode === "picking-list" && stagedDept ? (
          <span className={LEVEL_CHIP_CLASS}>
            <span className="min-w-0 truncate">{stagedDept.name}</span>
            <button
              type="button"
              className="shrink-0 rounded px-1 text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
              aria-label={`Change ${NODE_LABELS.level}`}
              onClick={() => {
                setStagedDeptId(null);
                setMode("picking-level");
                setQuery("");
              }}
            >
              ×
            </button>
          </span>
        ) : null}

        {mode === "idle" && !committedDept && !committedList ? (
          <button
            type="button"
            className="inline-flex items-center rounded-full border border-dashed border-[var(--border-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
            onClick={() => setMode("picking-level")}
          >
            Search {NODE_LABELS.level.toLowerCase()} &amp; {NODE_LABELS.list.toLowerCase()}
          </button>
        ) : null}
      </div>

      {mode !== "idle" ? (
        <div className="relative">
          <label htmlFor={inputId} className="sr-only">
            {mode === "picking-level"
              ? `Search ${NODE_LABELS.level.toLowerCase()}s`
              : `Search ${NODE_LABELS.list.toLowerCase()}s`}
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="search"
            autoComplete="off"
            aria-expanded
            aria-haspopup="listbox"
            aria-controls={optionsId}
            placeholder={
              mode === "picking-level"
                ? `Search ${NODE_LABELS.level.toLowerCase()}s…`
                : `Search ${NODE_LABELS.list.toLowerCase()}s in ${stagedDept?.name ?? ""}…`
            }
            className="input w-full rounded-xl text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") cancel();
            }}
          />
          <AnimatePresence>
            <motion.ul
              key={mode}
              id={optionsId}
              role="listbox"
              aria-label={mode === "picking-level" ? `${NODE_LABELS.level}s` : `${NODE_LABELS.list}s`}
              className="absolute z-[60] mt-1 max-h-52 w-full overflow-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] py-1"
              style={{ transformOrigin: "top" }}
              variants={panelPopVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              transition={{ duration: motionDuration(0.16, prefersReduced), ease: POP_EASE }}
            >
              {mode === "picking-level" ? (
                deptOptions.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-[var(--muted)]">No matches.</li>
                ) : (
                  deptOptions.map((d) => (
                    <li key={d.id} role="presentation">
                      <button
                        type="button"
                        role="option"
                        className="flex w-full items-center px-3 py-2 text-left text-sm font-medium text-[var(--fg)] transition-colors hover:bg-[var(--surface-hover)]"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setStagedDeptId(d.id);
                          setMode("picking-list");
                          setQuery("");
                        }}
                      >
                        {d.name}
                      </button>
                    </li>
                  ))
                )
              ) : listOptions.length === 0 ? (
                <li className="px-3 py-2 text-sm text-[var(--muted)]">
                  No {NODE_LABELS.list.toLowerCase()}s in this {NODE_LABELS.level.toLowerCase()}.
                </li>
              ) : (
                listOptions.map((l) => (
                  <li key={l.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      className="flex w-full items-center px-3 py-2 text-left text-sm font-medium text-[var(--fg)] transition-colors hover:bg-[var(--surface-hover)]"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onChange(l.id);
                        cancel();
                      }}
                    >
                      {l.name}
                    </button>
                  </li>
                ))
              )}
            </motion.ul>
          </AnimatePresence>
        </div>
      ) : null}
    </div>
  );
}
