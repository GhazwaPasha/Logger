import type { RoadmapStatus } from "@/lib/ledger-types";

export const STATUS_LABELS: Record<RoadmapStatus, string> = {
  on_track: "On track",
  at_risk: "At risk",
  done: "Done",
  archived: "Archived",
};

/** Dot/fill color per status — the one visual signal for status across every roadmap view. */
export const STATUS_DOT_CLASS: Record<RoadmapStatus, string> = {
  on_track: "bg-emerald-500",
  at_risk: "bg-amber-500",
  done: "bg-sky-500",
  archived: "bg-[var(--muted)]",
};

export const STATUS_BAR_CLASS: Record<RoadmapStatus, string> = {
  on_track: "bg-emerald-500/70",
  at_risk: "bg-amber-500/70",
  done: "bg-sky-500/70",
  archived: "bg-[var(--muted)]/50",
};

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const fmt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  return `${start.toLocaleDateString(undefined, fmt)} – ${end.toLocaleDateString(undefined, sameYear ? fmt : { ...fmt, year: "numeric" })}`;
}

export function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

/** Default range for a new milestone: a 2-week window starting at `anchor`, fully editable. */
export function defaultMilestoneRange(anchor: Date): [string, string] {
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const end = new Date(anchor.getTime() + 13 * 24 * 60 * 60 * 1000);
  return [fmt(anchor), fmt(end)];
}

/** Depth-tapered sizing for nested milestone bars on a Gantt track — root bars read as primary, each nested level recedes slightly. Pairs with the indent rail; doesn't touch color. */
export function milestoneDepthStyle(depth: number): { trackClass: string; barClass: string; textClass: string } {
  if (depth === 0) return { trackClass: "h-8", barClass: "h-6", textClass: "text-[11px] font-semibold" };
  if (depth === 1) return { trackClass: "h-7", barClass: "h-5", textClass: "text-[11px] font-medium" };
  return { trackClass: "h-6", barClass: "h-4", textClass: "text-[10px] font-medium" };
}
