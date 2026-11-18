"use client";

import { Segmented } from "@/components/ui/Segmented";
import { ZOOM_LEVELS } from "@/lib/roadmap-axis";

/** Day/Week/Month/Quarter/Year — the shared segmented control, small size for a card header. */
export function ZoomLevelSwitch({ value, onChange }: { value: number; onChange: (level: number) => void }) {
  return (
    <Segmented
      size="sm"
      value={String(value)}
      onChange={(v) => onChange(Number(v))}
      aria-label="Zoom level"
      options={ZOOM_LEVELS.map((level, i) => ({ value: String(i), label: level.label }))}
    />
  );
}
