import type { TrackerMetric, TrackerPace } from "@work-ledger/contracts";

/** Compact figure for big displays: 312k, 1.6M, 8.2k, 38. */
export function compactNumber(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "–";
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}M`;
  if (a >= 100_000) return `${Math.round(v / 1000)}k`;
  if (a >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

/** Full figure with grouping, used in entries and inputs. */
export function fullNumber(v: number | null | undefined, maxFraction = 2): string {
  if (v == null || !Number.isFinite(v)) return "–";
  return v.toLocaleString(undefined, { maximumFractionDigits: maxFraction });
}

export function metricValue(m: Pick<TrackerMetric, "unit" | "currency">, v: number | null | undefined, compact = true) {
  if (v == null) return "–";
  const n = compact ? compactNumber(v) : fullNumber(v);
  return m.unit === "percent" ? `${n}%` : n;
}

export const PACE_LABEL: Record<TrackerPace, string> = {
  ahead: "Ahead",
  on_pace: "On pace",
  behind: "Behind",
  met: "Target met",
  missed: "Missed",
  none: "No target",
};

/** Colour only ever carries status. */
export const PACE_TEXT: Record<TrackerPace, string> = {
  ahead: "text-emerald-600 dark:text-emerald-400",
  on_pace: "text-emerald-600 dark:text-emerald-400",
  met: "text-emerald-600 dark:text-emerald-400",
  behind: "text-red-600 dark:text-red-400",
  missed: "text-red-600 dark:text-red-400",
  none: "text-[var(--muted)]",
};

export const PACE_DOT: Record<TrackerPace, string> = {
  ahead: "bg-emerald-500",
  on_pace: "bg-emerald-500",
  met: "bg-emerald-500",
  behind: "bg-red-500",
  missed: "bg-red-500",
  none: "bg-[var(--border)]",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function dayLabel(key: string, today?: string): string {
  if (today && key === today) return "Today";
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DAYS[wd === 0 ? 6 : wd - 1]} ${d} ${MONTHS[m - 1]}`;
}

export function shortDate(key: string): string {
  const [, m, d] = key.split("-").map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]}`;
}

export function periodLabel(start: string, end: string): string {
  return `${shortDate(start)} – ${shortDate(end)}`;
}

export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
