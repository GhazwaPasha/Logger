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
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCaretDown } from "@fortawesome/free-solid-svg-icons";
import { POP_EASE, motionDuration, panelPopVariants } from "./motion-presets";

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
};

const PANEL_MIN_W = 180;
const ITEM_H = 36;

type Props<T extends string> = {
  value: T;
  onChange: (v: T) => void;
  options: SelectOption<T>[];
  disabled?: boolean;
  /** Full className for the trigger button. Defaults to the app tile-button style. */
  triggerClassName?: string;
  /** Custom content inside the trigger button (replaces the default label). */
  triggerContent?: React.ReactNode;
  /** Show a caret chevron after the label. Default true. */
  showChevron?: boolean;
  "aria-label"?: string;
};

export function SelectPopover<T extends string>({
  value,
  onChange,
  options,
  disabled,
  triggerClassName,
  triggerContent,
  showChevron = true,
  "aria-label": ariaLabel,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const prefersReduced = useReducedMotion();
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, flipped: false });

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    const panelW = Math.max(rect.width, PANEL_MIN_W);
    const panelEstH = options.length * ITEM_H + 16;

    let left = rect.left;
    if (left + panelW > window.innerWidth - pad) left = Math.max(pad, window.innerWidth - panelW - pad);
    if (left < pad) left = pad;

    let top = rect.bottom + 4;
    let flipped = false;
    if (top + panelEstH > window.innerHeight - pad) {
      top = Math.max(pad, rect.top - panelEstH - 4);
      flipped = true;
    }

    setPos({ top, left, width: panelW, flipped });
  }, [options.length]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
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
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const currentLabel = options.find((o) => o.value === value)?.label ?? value;

  const defaultTriggerClass =
    "inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        className={triggerClassName ?? defaultTriggerClass}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={panelId}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((v) => !v)}
      >
        {triggerContent ?? <span className="truncate">{currentLabel}</span>}
        {showChevron && (
          <FontAwesomeIcon
            icon={faCaretDown}
            className={`ml-auto size-3 shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={panelRef}
                id={panelId}
                role="listbox"
                aria-label={ariaLabel}
                className="fixed z-[200] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-1 shadow-lg shadow-black/10 dark:shadow-black/40"
                style={{
                  top: pos.top,
                  left: pos.left,
                  width: pos.width,
                  minWidth: PANEL_MIN_W,
                  transformOrigin: pos.flipped ? "bottom" : "top",
                }}
                variants={panelPopVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                transition={{ duration: motionDuration(0.18, prefersReduced), ease: POP_EASE }}
              >
                {options.map((opt) => {
                  const active = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`flex w-full items-center rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                        active
                          ? "bg-[var(--accent-muted)] font-semibold text-[var(--fg)]"
                          : "font-medium text-[var(--fg)] hover:bg-[var(--surface-hover)]"
                      }`}
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
