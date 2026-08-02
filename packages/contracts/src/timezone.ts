/**
 * Timezone conversion shared by the API and the web app. Both run on plain Node/V8 `Intl`, so one
 * implementation covers both — no date library dependency needed.
 */

export type ZonedParts = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 (Sunday) - 6 (Saturday), matching `Date#getDay`. */
  weekday: number;
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
}

/** Reads `date`'s wall-clock date/time as it appears in `timeZone` — the timezone-aware replacement
 *  for `Date#getFullYear/getMonth/getDate/getHours/getMinutes/getDay`. */
export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(date);
  const byType = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    year: Number(byType.year),
    month: Number(byType.month),
    day: Number(byType.day),
    hour: Number(byType.hour === "24" ? "0" : byType.hour),
    minute: Number(byType.minute),
    second: Number(byType.second),
    weekday: WEEKDAY_INDEX[byType.weekday ?? "Sun"] ?? 0,
  };
}

/** Offset (ms) to add to a UTC instant to get the wall-clock time shown in `timeZone`, i.e. `utc + offset = zoned`. */
function tzOffsetMs(utcInstant: Date, timeZone: string): number {
  const p = getZonedParts(utcInstant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - utcInstant.getTime();
}

/** Inverse of {@link getZonedParts}: given wall-clock values meant as local time in `timeZone`,
 *  returns the UTC instant they correspond to. One offset-correction pass — exact for every
 *  real-world zone except the (rare, sub-hour) repeated-hour ambiguity at a DST fall-back. */
export function zonedPartsToUtc(
  parts: { year: number; month: number; day: number; hour: number; minute: number; second?: number },
  timeZone: string,
): Date {
  const guessMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second ?? 0);
  const offset = tzOffsetMs(new Date(guessMs), timeZone);
  return new Date(guessMs - offset);
}

/** Formats `date` in `timeZone`; thin wrapper so call sites can't accidentally omit `timeZone` and
 *  fall back to the host's local zone. */
export function formatInTimeZone(
  date: Date,
  timeZone: string,
  opts: Intl.DateTimeFormatOptions,
  locale: string | string[] = "en-US",
): string {
  return new Intl.DateTimeFormat(locale, { ...opts, timeZone }).format(date);
}

/** `YYYY-MM-DD` for `date` as it reads in `timeZone` — the zoned equivalent of `toISOString().slice(0, 10)`. */
export function formatZonedDateKey(date: Date, timeZone: string): string {
  const p = getZonedParts(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}
