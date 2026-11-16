"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import type { MemberRow } from "@/lib/ledger-types";
import { Avatar } from "@/components/ui/Avatar";
import { POP_EASE, motionDuration, panelPopVariants } from "@/components/ui/motion-presets";

const label = (m: MemberRow) => (m.name ?? "").trim() || (m.email ?? "").trim() || "Unknown";

/**
 * Pick exactly one person by typing: shows the chosen person as a chip, turns into a search box on
 * click, filters by name or email, and supports ↑/↓/Enter/Escape. Same dropdown styling as the task
 * page's assignee search.
 */
export function PersonSearchField({
  members,
  value,
  onChange,
  placeholder = "Search name or email…",
  allowNone = false,
}: {
  members: MemberRow[];
  value: string;
  /** `""` when "No one yet" is picked (only offered with `allowNone`). */
  onChange: (userId: string) => void;
  placeholder?: string;
  /** Offer a "No one yet" choice that clears the pick. */
  allowNone?: boolean;
}) {
  const reduced = useReducedMotion();
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = members.find((m) => m.userId === value) ?? null;

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members
      .filter((m) => !q || label(m).toLowerCase().includes(q) || (m.email ?? "").toLowerCase().includes(q))
      .sort((a, b) => label(a).localeCompare(label(b)));
  }, [members, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function openSearch() {
    setQuery("");
    setActive(Math.max(0, options.findIndex((m) => m.userId === value)));
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function pick(m: MemberRow) {
    onChange(m.userId);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={wrapRef} className="relative">
      {open ? (
        <div className="flex h-9 items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2.5">
          <FontAwesomeIcon icon={faMagnifyingGlass} className="size-3 text-[var(--muted)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(options.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const m = options[active];
                if (m) pick(m);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder={placeholder}
            role="combobox"
            aria-expanded
            aria-controls={`${uid}-list`}
            aria-activedescendant={options[active] ? `${uid}-${options[active]!.userId}` : undefined}
            aria-label="Search people"
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--fg)] outline-none placeholder:text-[var(--muted)]"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={openSearch}
          aria-haspopup="listbox"
          className={`inline-flex h-9 max-w-full items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2.5 text-sm font-semibold transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--surface-hover)] active:scale-[0.97] ${
            selected ? "pl-1.5 text-[var(--fg)]" : "text-[var(--muted)]"
          }`}
        >
          {selected ? (
            <Avatar
              name={selected.name}
              email={selected.email}
              image={selected.image}
              size="size-6"
              className="bg-[var(--accent-muted)] text-[10px] font-semibold text-[var(--fg)]"
            />
          ) : (
            <FontAwesomeIcon icon={faMagnifyingGlass} className="size-3" />
          )}
          <span className="truncate">{selected ? label(selected) : allowNone ? "Unassigned" : "Search for a person"}</span>
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.ul
            id={`${uid}-list`}
            role="listbox"
            aria-label="Team members"
            className="absolute z-[60] mt-1 max-h-60 w-full min-w-[14rem] overflow-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] py-1"
            style={{ transformOrigin: "top" }}
            variants={panelPopVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: motionDuration(0.16, reduced), ease: POP_EASE }}
          >
            {allowNone && value && !query.trim() ? (
              <li role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)]"
                >
                  <span className="size-6 shrink-0 rounded-full border border-dashed border-[var(--border)]" />
                  No one yet
                </button>
              </li>
            ) : null}
            {options.length === 0 ? (
              <li className="px-3 py-2 text-sm text-[var(--muted)]">
                {members.length === 0 ? "No team members in this workspace." : "No matches · try another name or email."}
              </li>
            ) : (
              options.map((m, i) => {
                const on = m.userId === value;
                const email = (m.email ?? "").trim();
                return (
                  <li key={m.userId} role="presentation">
                    <button
                      id={`${uid}-${m.userId}`}
                      type="button"
                      role="option"
                      aria-selected={on}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => pick(m)}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                        i === active ? "bg-[var(--surface-hover)]" : ""
                      }`}
                    >
                      <Avatar
                        name={m.name}
                        email={m.email}
                        image={m.image}
                        size="size-6"
                        className="shrink-0 bg-[var(--accent-muted)] text-[10px] font-semibold text-[var(--fg)]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-[var(--fg)]">{label(m)}</span>
                        {(m.name ?? "").trim() && email ? (
                          <span className="block truncate text-xs text-[var(--muted)]">{email}</span>
                        ) : null}
                      </span>
                      {on && <FontAwesomeIcon icon={faCheck} className="size-3 shrink-0 text-[var(--fg)]" />}
                    </button>
                  </li>
                );
              })
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
