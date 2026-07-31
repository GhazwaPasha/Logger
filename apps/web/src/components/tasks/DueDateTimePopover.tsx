"use client";

import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { DueDateTimePanel } from "./DueDateTimePanel";
import { POP_EASE, motionDuration, panelPopVariants } from "@/components/ui/motion-presets";

function formatDueTriggerLabel(value: string): string {
  const t = value.trim();
  if (!t) return "Set due";
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "Set due";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

const POPOVER_W = 236;
const POPOVER_EST_H = 340;

type DueDateTimePopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onChange: (localValue: string) => void;
  onClear: () => void;
  /** Overrides the trigger's default muted text color (e.g. to flag an overdue or upcoming due date). */
  triggerColorClassName?: string;
};

export function DueDateTimePopover({
  open,
  onOpenChange,
  value,
  onChange,
  onClear,
  triggerColorClassName,
}: DueDateTimePopoverProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const panelId = useId();
  const prefersReduced = useReducedMotion();

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    let left = rect.left;
    if (left + POPOVER_W > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - POPOVER_W - pad);
    }
    if (left < pad) left = pad;

    let top = rect.bottom + 6;
    if (top + POPOVER_EST_H > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - POPOVER_EST_H - pad);
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

  const handleClear = useCallback(() => {
    onClear();
    onOpenChange(false);
  }, [onClear, onOpenChange]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-sm font-medium transition-colors hover:text-[var(--fg)] ${triggerColorClassName ?? "text-[var(--muted)]"} ${open ? "ring-2 ring-[var(--accent)]/40" : ""}`}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={() => onOpenChange(!open)}
      >
        {formatDueTriggerLabel(value)}
      </button>
      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={panelRef}
                id={panelId}
                role="dialog"
                aria-label="Due date and time"
                className="due-popover-scroll fixed z-[100] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-2"
                style={{
                  top: pos.top,
                  left: pos.left,
                  width: POPOVER_W,
                  maxHeight: "min(78vh, 420px)",
                  transformOrigin: "top",
                }}
                variants={panelPopVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                transition={{ duration: motionDuration(0.18, prefersReduced), ease: POP_EASE }}
              >
                <DueDateTimePanel
                  compact
                  value={value}
                  onChange={onChange}
                  onClear={handleClear}
                  onSave={() => onOpenChange(false)}
                />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
