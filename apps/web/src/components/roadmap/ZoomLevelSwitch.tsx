"use client";

import { ZOOM_LEVELS } from "@/lib/roadmap-axis";

/** Day/Week/Month/Quarter/Year segmented control — same visual pattern as the Outline/Timeline/Grand Roadmap/By-level view switcher, scaled down to fit a card header. */
export function ZoomLevelSwitch({ value, onChange }: { value: number; onChange: (level: number) => void }) {
  return (
    <div
      className="inline-flex shrink-0 items-center rounded-lg bg-[var(--surface-elevated)] p-0.5"
      role="group"
      aria-label="Zoom level"
    >
      {ZOOM_LEVELS.map((level, i) => (
        <button
          key={level.id}
          type="button"
          className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)] ${
            value === i
              ? "bg-[var(--accent-muted)] text-[var(--fg)]"
              : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
          }`}
          onClick={() => onChange(i)}
          aria-pressed={value === i}
        >
          {level.label}
        </button>
      ))}
    </div>
  );
}
