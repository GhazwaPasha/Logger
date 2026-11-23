"use client";

import { useId, useRef, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  /** Shown instead of (or, with `showLabel`, before) the label. The label stays as the accessible name. */
  icon?: ReactNode;
  showLabel?: boolean;
};

/**
 * THE filter / view switch for the whole app — use this instead of hand-rolling a row of toggle buttons.
 *
 * - `md` (default): page toolbars. 3px inset, 36px segments — exactly the task board toolbar, so a
 *   toolbar's New button (40px), filters and icon buttons all line up on every page.
 * - `sm`: small controls inside a card header (chart ranges, zoom).
 *
 * The selected segment is a card-coloured thumb with a soft shadow that slides between options;
 * no accent colour or outline. Arrow keys move the selection (radio-group pattern).
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  className,
  "aria-label": ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentedOption<T>[];
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
}) {
  const id = useId();
  const reduced = useReducedMotion();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const sm = size === "sm";

  function move(from: number, dir: 1 | -1) {
    const next = (from + dir + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex shrink-0 gap-0.5 bg-[var(--fill)]",
        sm ? "rounded-[10px] p-0.5" : "rounded-[13px] p-[3px]",
        className,
      )}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        const iconOnly = o.icon != null && !o.showLabel;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={iconOnly ? o.label : undefined}
            title={iconOnly ? o.label : undefined}
            tabIndex={on ? 0 : -1}
            // Pointer-down, not click: the thumb starts moving the instant you press.
            onPointerDown={(e) => {
              if (e.button === 0) onChange(o.value);
            }}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                move(i, 1);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                move(i, -1);
              }
            }}
            className={cn(
              "pressable relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
              sm ? "h-6 rounded-lg text-xs" : "h-9 rounded-[10px] text-footnote",
              iconOnly ? (sm ? "w-7" : "w-11") : sm ? "px-2.5" : "px-3.5",
              on ? "text-[var(--fg)]" : "text-[var(--muted)] hover:text-[var(--fg)]",
            )}
          >
            {on && (
              <motion.span
                layoutId={`seg-${id}`}
                className={cn("absolute inset-0 bg-[var(--card)] shadow-card", sm ? "rounded-lg" : "rounded-[10px]")}
                transition={reduced ? { duration: 0 } : { type: "spring", bounce: 0, duration: 0.3 }}
              />
            )}
            {o.icon != null && <span className="relative inline-flex" aria-hidden>{o.icon}</span>}
            {!iconOnly && <span className="relative">{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
