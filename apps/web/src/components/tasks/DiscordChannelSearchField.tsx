"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock } from "@fortawesome/free-solid-svg-icons";
import type { DiscordChannelOption } from "@/lib/ledger-types";
import { POP_EASE, motionDuration, panelPopVariants } from "@/components/ui/motion-presets";

function matchesQuery(c: DiscordChannelOption, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return c.name.toLowerCase().includes(s);
}

export type DiscordChannelSearchFieldProps = {
  channels: DiscordChannelOption[];
  value: string | null;
  onChange: (channelId: string | null) => void;
};

export function DiscordChannelSearchField({ channels, value, onChange }: DiscordChannelSearchFieldProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const uid = useId();
  const inputId = `${uid}-discord-channel-query`;
  const optionsId = `${uid}-discord-channel-options`;
  const prefersReduced = useReducedMotion();

  const selected = channels.find((c) => c.id === value) ?? null;

  const available = useMemo(() => {
    return channels
      .filter((c) => c.id !== value)
      .filter((c) => matchesQuery(c, query))
      .sort((a, b) => a.position - b.position);
  }, [channels, value, query]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="space-y-2">
      {selected ? (
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex max-w-full items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2.5 py-1 text-sm text-[var(--fg)]">
            {selected.isPrivate && (
              <FontAwesomeIcon icon={faLock} className="size-3 shrink-0 text-[var(--muted)]" aria-label="Private channel" />
            )}
            <span className="min-w-0 truncate">#{selected.name}</span>
            <button
              type="button"
              className="shrink-0 rounded px-1 text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
              aria-label={`Remove #${selected.name}`}
              onClick={() => onChange(null)}
            >
              ×
            </button>
          </span>
        </div>
      ) : null}

      <div ref={containerRef} className="relative">
        <label htmlFor={inputId} className="sr-only">
          Search Discord channels
        </label>
        <input
          id={inputId}
          type="search"
          autoComplete="off"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={optionsId}
          placeholder={selected ? "Search another channel…" : "Search channels…"}
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
        <AnimatePresence>
          {open && (
            <motion.ul
              id={optionsId}
              role="listbox"
              aria-label="Discord channels"
              className="absolute z-[60] mt-1 max-h-52 w-full overflow-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] py-1"
              style={{ transformOrigin: "top" }}
              variants={panelPopVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              transition={{ duration: motionDuration(0.16, prefersReduced), ease: POP_EASE }}
            >
              {available.length === 0 ? (
                <li className="px-3 py-2 text-sm text-[var(--muted)]">No matches · try another channel name.</li>
              ) : (
                available.map((c) => (
                  <li key={c.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      className="flex w-full items-center gap-1 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-hover)]"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onChange(c.id);
                        setQuery("");
                        setOpen(false);
                      }}
                    >
                      <span className="font-medium text-[var(--fg)]">#{c.name}</span>
                      {c.isPrivate && (
                        <FontAwesomeIcon icon={faLock} className="size-3 shrink-0 text-[var(--muted)]" aria-label="Private channel" />
                      )}
                    </button>
                  </li>
                ))
              )}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
