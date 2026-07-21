"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckSquare, Clock, ClockUser, XSquare } from "@phosphor-icons/react";
import { FLOW_COLUMN_LABELS, statusPillPaletteClasses, type ManualTaskStatus } from "@/lib/task-board";

/** Same box for every workflow stage (`max-w` keeps dropdowns compact; label truncates). */
export const STATUS_PILL_LAYOUT =
  "relative inline-flex h-8 w-[6.875rem] min-w-[6.875rem] max-w-[6.875rem] shrink-0 items-center justify-between gap-0.5 px-1.5";

/** Kanban card meta row: status pill is icon-only, compact. */
export const KANBAN_STATUS_SHELL_LAYOUT =
  "relative inline-flex h-6 w-auto min-w-[5.5rem] shrink-0 items-center rounded";

export function StatusIcon({ status, className, size }: { status: ManualTaskStatus; className?: string; size?: number }) {
  if (status === "done") return <CheckSquare className={className} size={size} weight="fill" aria-hidden />;
  if (status === "in_progress") return <ClockUser className={className} size={size} weight="fill" aria-hidden />;
  if (status === "cancelled") return <XSquare className={className} size={size} weight="fill" aria-hidden />;
  return <Clock className={className} size={size} weight="regular" aria-hidden />;
}

/** Shared status pill/dropdown control — used by the board (list/kanban cards) and the task view panel. */
export function StatusPillSelect({
  "aria-label": ariaLabel,
  value,
  onChange,
  options,
  disabled,
  pending,
  shellLayoutClassName = STATUS_PILL_LAYOUT,
}: {
  "aria-label": string;
  value: ManualTaskStatus;
  onChange: (next: ManualTaskStatus) => void;
  options: readonly ManualTaskStatus[];
  disabled?: boolean;
  /** Server sync in progress (e.g. PATCH status). */
  pending?: boolean;
  /** Outer box sizing (list row uses fixed width; kanban uses equal flex cells). */
  shellLayoutClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();
  const paletteKey = value;

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setMenuPos(null);
      return;
    }
    const el = triggerRef.current;
    const sync = () => {
      const r = el.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 6, left: r.left, width: Math.max(r.width, el.offsetWidth) });
    };
    sync();
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [open]);

  useEffect(() => {
    if (pending) setOpen(false);
  }, [pending]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const blocked = disabled || pending;

  return (
    <div
      className={`relative ${shellLayoutClassName} ${statusPillPaletteClasses(paletteKey)} ${pending ? "opacity-[0.88]" : ""}`}
    >
      <button
        ref={triggerRef}
        type="button"
        disabled={blocked}
        aria-expanded={open}
        aria-busy={pending || undefined}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        id={`${listboxId}-trigger`}
        onClick={() => {
          if (blocked) return;
          setOpen((o) => !o);
        }}
        className="absolute inset-0 z-[1] flex cursor-pointer items-center justify-center rounded-[inherit] px-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="pointer-events-none truncate text-[12px] font-semibold leading-none tracking-tight">
          {FLOW_COLUMN_LABELS[value]}
        </span>
      </button>
      {open && menuPos
        ? createPortal(
            <ul
              ref={menuRef}
              id={listboxId}
              role="listbox"
              style={{
                position: "fixed",
                top: menuPos.top,
                left: menuPos.left,
                minWidth: menuPos.width,
                zIndex: 80,
              }}
              className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] py-1 dark:bg-[var(--surface-base)]"
            >
              {options.map((s) => (
                <li key={s} role="presentation" className="px-1">
                  <button
                    type="button"
                    role="option"
                    id={`${listboxId}-opt-${s}`}
                    aria-selected={s === value}
                    className={`flex w-full min-w-[8rem] items-center gap-2 rounded-md px-2 py-2 text-left text-[12px] font-semibold leading-snug tracking-tight outline-none transition-colors focus-visible:bg-[var(--surface-hover)] ${
                      s === value
                        ? "bg-[var(--accent-muted)]/55 text-[var(--fg)]"
                        : "text-[var(--fg)] hover:bg-[var(--surface-hover)]"
                    }`}
                    onClick={() => {
                      setOpen(false);
                      if (s !== value) onChange(s);
                      queueMicrotask(() => triggerRef.current?.focus());
                    }}
                  >
                    <StatusIcon status={s} size={16} className="opacity-70" />
                    {FLOW_COLUMN_LABELS[s]}
                  </button>
                </li>
              ))}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}
