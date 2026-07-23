export const DAY_MS = 24 * 60 * 60 * 1000;

export type TickGranularity = "day" | "week" | "month" | "quarter" | "year";
export type Tick = { pos: number; label: string };
export type ZoomLevel = { id: string; label: string; days: number; granularity: TickGranularity };

/** Day → Year, each with a target visible day-span and its own tick vocabulary — a Gantt's gridline labels change qualitatively per band, so discrete levels beat continuous zoom. */
export const ZOOM_LEVELS: ZoomLevel[] = [
  { id: "day", label: "Day", days: 10, granularity: "day" },
  { id: "week", label: "Week", days: 56, granularity: "week" },
  { id: "month", label: "Month", days: 180, granularity: "month" },
  { id: "quarter", label: "Quarter", days: 730, granularity: "quarter" },
  { id: "year", label: "Year", days: 1825, granularity: "year" },
];

export function clampZoomLevel(level: number): number {
  return Math.max(0, Math.min(ZOOM_LEVELS.length - 1, level));
}

/** Padded min/max across a flat list of date spans — falls back to a year around today when empty. Used only to seed/reset zoom+pan, never as a hard constraint. */
export function computeNaturalRange(spans: { start: number; end: number }[]): { start: number; end: number } {
  let min: number | null = null;
  let max: number | null = null;
  for (const s of spans) {
    if (min === null || s.start < min) min = s.start;
    if (max === null || s.end > max) max = s.end;
  }
  if (min === null || max === null) {
    const now = new Date().getTime();
    return { start: now - 60 * DAY_MS, end: now + 305 * DAY_MS };
  }
  const pad = Math.max((max - min) * 0.06, 3 * DAY_MS);
  return { start: min - pad, end: max + pad };
}

/** Picks the zoom level whose target span is closest to the given range, centered on its midpoint. */
export function fitZoomToRange(range: { start: number; end: number }): { zoomLevel: number; centerDate: number } {
  const spanDays = (range.end - range.start) / DAY_MS;
  let bestIdx = 0;
  let bestDiff = Infinity;
  ZOOM_LEVELS.forEach((level, i) => {
    const diff = Math.abs(level.days - spanDays);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  });
  return { zoomLevel: bestIdx, centerDate: (range.start + range.end) / 2 };
}

function fmtMonthShort(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short" });
}

/** Granularity-aware gridline ticks between axisStart/axisEnd, positioned as % across the span. */
export function buildTicks(axisStart: number, axisEnd: number, granularity: TickGranularity): Tick[] {
  const pos = (t: number) => ((t - axisStart) / (axisEnd - axisStart)) * 100;
  const startDate = new Date(axisStart);
  const ticks: Tick[] = [];

  if (granularity === "day") {
    let cursor = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate());
    if (cursor < axisStart) cursor += DAY_MS;
    let lastMonth: number | null = null;
    while (cursor < axisEnd) {
      const d = new Date(cursor);
      const month = d.getUTCMonth();
      const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
      const label = month !== lastMonth ? `${weekday} ${fmtMonthShort(d)} ${d.getUTCDate()}` : `${weekday} ${d.getUTCDate()}`;
      lastMonth = month;
      ticks.push({ pos: pos(cursor), label });
      cursor += DAY_MS;
    }
    return ticks;
  }

  if (granularity === "week") {
    const dow = startDate.getUTCDay();
    const daysSinceMonday = (dow + 6) % 7;
    let cursor = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate() - daysSinceMonday);
    if (cursor < axisStart) cursor += 7 * DAY_MS;
    let lastYear: number | null = null;
    while (cursor < axisEnd) {
      const d = new Date(cursor);
      const year = d.getUTCFullYear();
      const label = lastYear !== year ? `${fmtMonthShort(d)} ${d.getUTCDate()}, ${year}` : `${fmtMonthShort(d)} ${d.getUTCDate()}`;
      lastYear = year;
      ticks.push({ pos: pos(cursor), label });
      cursor += 7 * DAY_MS;
    }
    return ticks;
  }

  if (granularity === "month") {
    const spanDays = (axisEnd - axisStart) / DAY_MS;
    const stepMonths = spanDays <= 100 ? 1 : spanDays <= 260 ? 2 : 3;
    let cursor = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1);
    if (cursor < axisStart) cursor = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 1);
    let lastYear: number | null = null;
    while (cursor < axisEnd) {
      const d = new Date(cursor);
      const year = d.getUTCFullYear();
      const label = lastYear !== year ? `${fmtMonthShort(d)} ${year}` : fmtMonthShort(d);
      lastYear = year;
      ticks.push({ pos: pos(cursor), label });
      cursor = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + stepMonths, 1);
    }
    return ticks;
  }

  if (granularity === "quarter") {
    const startQuarterMonth = Math.floor(startDate.getUTCMonth() / 3) * 3;
    let cursor = Date.UTC(startDate.getUTCFullYear(), startQuarterMonth, 1);
    if (cursor < axisStart) cursor = Date.UTC(startDate.getUTCFullYear(), startQuarterMonth + 3, 1);
    while (cursor < axisEnd) {
      const d = new Date(cursor);
      const q = Math.floor(d.getUTCMonth() / 3) + 1;
      ticks.push({ pos: pos(cursor), label: `Q${q} ${d.getUTCFullYear()}` });
      cursor = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3, 1);
    }
    return ticks;
  }

  // year
  const spanDays = (axisEnd - axisStart) / DAY_MS;
  const stepYears = spanDays <= 800 ? 1 : spanDays <= 2000 ? 2 : 5;
  let cursor = Date.UTC(startDate.getUTCFullYear(), 0, 1);
  if (cursor < axisStart) cursor = Date.UTC(startDate.getUTCFullYear() + 1, 0, 1);
  while (cursor < axisEnd) {
    const d = new Date(cursor);
    ticks.push({ pos: pos(cursor), label: String(d.getUTCFullYear()) });
    cursor = Date.UTC(d.getUTCFullYear() + stepYears, 0, 1);
  }
  return ticks;
}
