"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { TaskDueRepeat } from "@/lib/ledger-types";

const REPEAT_OPTIONS: { value: TaskDueRepeat; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const REPEAT_LABEL: Record<TaskDueRepeat, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

function repeatTriggerLabel(dueSet: boolean, repeat: TaskDueRepeat | null | undefined): string {
  if (!dueSet) return "Repeat";
  if (repeat) return REPEAT_LABEL[repeat];
  return "Repeat";
}

const PANEL_W = 220;
const PANEL_EST_H = 200;

type DueRepeatPopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Same shape as due popover (`YYYY-MM-DDTHH:mm` or ""). Repeat UI disabled until set. */
  dueLocalValue: string;
  value: TaskDueRepeat | null;
  onChange: (next: TaskDueRepeat | null) => void;
};

export function DueRepeatPopover({
  open,
  onOpenChange,
  dueLocalValue,
  value,
  onChange,
}: DueRepeatPopoverProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const panelId = useId();
  const dueSet = dueLocalValue.trim().length > 0;

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    let left = rect.left;
    if (left + PANEL_W > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - PANEL_W - pad);
    }
    if (left < pad) left = pad;

    let top = rect.bottom + 6;
    if (top + PANEL_EST_H > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - PANEL_EST_H - pad);
    }

    setPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition, value]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      onOpenChange(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  const label = repeatTriggerLabel(dueSet, value);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={!dueSet}
        className={`min-w-0 max-w-[min(100%,18rem)] rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-left text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--fg)] disabled:pointer-events-none disabled:opacity-45 ${open ? "ring-2 ring-[var(--accent)]/40" : ""}`}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        aria-label={dueSet && value ? `Repeat: ${REPEAT_LABEL[value]}` : "Repeat"}
        title={dueSet ? (value ? `Repeats ${REPEAT_LABEL[value]}` : "Choose repeat") : "Set a due date first"}
        onClick={() => {
          if (!dueSet) return;
          onOpenChange(!open);
        }}
      >
        <span className="block truncate">{label}</span>
      </button>
      {open &&
        dueSet &&
        typeof window !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label="Due repeat"
            className="due-popover-scroll fixed z-[100] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-2"
            style={{
              top: pos.top,
              left: pos.left,
              width: PANEL_W,
              maxHeight: "min(78vh, 280px)",
            }}
          >
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">Repeat</p>
            <div className="grid grid-cols-2 gap-1">
              {REPEAT_OPTIONS.map(({ value: rv, label: optLabel }) => {
                const active = value === rv;
                return (
                  <button
                    key={rv}
                    type="button"
                    onClick={() => onChange(active ? null : rv)}
                    aria-pressed={active}
                    className={`rounded-md border px-2 py-1.5 text-center text-[11px] font-medium transition-colors ${
                      active
                        ? "border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--fg)]"
                        : "border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-[var(--muted)] hover:border-[var(--border)] hover:text-[var(--fg)]"
                    }`}
                  >
                    {optLabel}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] leading-snug text-[var(--muted)]">Tap again to clear. Stored on the task.</p>
          </div>,
          document.body,
        )}
    </>
  );
}
