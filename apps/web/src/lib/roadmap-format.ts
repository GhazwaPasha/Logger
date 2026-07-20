import type { RoadmapPeriod, RoadmapStatus } from "@/lib/ledger-types";

export const PERIOD_LABELS: Record<RoadmapPeriod, string> = {
  yearly: "Year",
  quarterly: "Quarter",
  monthly: "Month",
  weekly: "Week",
};

export const PERIOD_BADGE_CLASS: Record<RoadmapPeriod, string> = {
  yearly: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  quarterly: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  monthly: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  weekly: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
};

export const CHILD_PERIOD: Record<RoadmapPeriod, RoadmapPeriod | null> = {
  yearly: "quarterly",
  quarterly: "monthly",
  monthly: "weekly",
  weekly: null,
};

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

/** The calendar period (year/quarter/month/Mon-start week) containing `anchor`, as [start, end] date-input strings. */
export function defaultRangeForPeriod(period: RoadmapPeriod, anchor: Date): [string, string] {
  const y = anchor.getUTCFullYear();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

  if (period === "yearly") {
    return [fmt(new Date(Date.UTC(y, 0, 1))), fmt(new Date(Date.UTC(y, 11, 31)))];
  }
  if (period === "quarterly") {
    const qStartMonth = Math.floor(anchor.getUTCMonth() / 3) * 3;
    return [
      fmt(new Date(Date.UTC(y, qStartMonth, 1))),
      fmt(new Date(Date.UTC(y, qStartMonth + 3, 0))),
    ];
  }
  if (period === "monthly") {
    const m = anchor.getUTCMonth();
    return [fmt(new Date(Date.UTC(y, m, 1))), fmt(new Date(Date.UTC(y, m + 1, 0)))];
  }
  // weekly — Monday-start week containing `anchor`
  const dow = anchor.getUTCDay();
  const daysSinceMonday = (dow + 6) % 7;
  const monday = new Date(Date.UTC(y, anchor.getUTCMonth(), anchor.getUTCDate() - daysSinceMonday));
  const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);
  return [fmt(monday), fmt(sunday)];
}
