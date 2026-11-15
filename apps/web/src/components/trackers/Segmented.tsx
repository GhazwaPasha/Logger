"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "motion/react";

/** Segmented control with a sliding pill (Animate UI "tabs" highlight). Critically damped, no bounce. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "sm",
  "aria-label": ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  size?: "sm" | "md";
  "aria-label"?: string;
}) {
  const id = useId();
  const reduced = useReducedMotion();
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded-[9px] bg-[var(--surface-muted)] p-0.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onPointerDown={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onChange(o.value);
            }}
            className={`relative rounded-[7px] ${size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-[13px]"} transition-colors ${
              on ? "text-[var(--fg)]" : "text-[var(--muted)] hover:text-[var(--fg)]"
            }`}
          >
            {on && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-[7px] border border-[var(--border-subtle)] bg-[var(--bg)]"
                transition={reduced ? { duration: 0 } : { type: "spring", bounce: 0, duration: 0.3 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
