import { formatInTimeZone, formatZonedDateKey, getZonedParts, zonedPartsToUtc, type ZonedParts } from "@work-ledger/contracts";

export { formatInTimeZone, formatZonedDateKey, getZonedParts, zonedPartsToUtc, type ZonedParts };

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** `YYYY-MM-DDTHH:mm` (the shape `<input type="datetime-local">` / due-date state uses) for `date`
 *  as it reads in `timeZone` — the org-timezone-aware replacement for reading `Date` getters directly. */
export function dueAtToZonedInput(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = getZonedParts(d, timeZone);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** Inverse of {@link dueAtToZonedInput}: parses a `YYYY-MM-DDTHH:mm` string as wall-clock time in
 *  `timeZone` and returns the UTC instant, or `null` if `value` is blank/unparseable. */
export function zonedInputToDueAt(value: string, timeZone: string): Date | null {
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  return zonedPartsToUtc(
    { year: Number(y), month: Number(mo), day: Number(d), hour: Number(h), minute: Number(mi) },
    timeZone,
  );
}

/** Midnight at the start of `date`'s calendar day in `timeZone`. */
export function startOfDayInTz(date: Date, timeZone: string): Date {
  const p = getZonedParts(date, timeZone);
  return zonedPartsToUtc({ year: p.year, month: p.month, day: p.day, hour: 0, minute: 0, second: 0 }, timeZone);
}

/** The last instant of `date`'s calendar day in `timeZone`. */
export function endOfDayInTz(date: Date, timeZone: string): Date {
  const p = getZonedParts(date, timeZone);
  return zonedPartsToUtc({ year: p.year, month: p.month, day: p.day, hour: 23, minute: 59, second: 59 }, timeZone);
}

/** Start of the Monday-first week containing `date`, in `timeZone`. */
export function startOfWeekInTz(date: Date, timeZone: string): Date {
  const start = startOfDayInTz(date, timeZone);
  const weekday = getZonedParts(start, timeZone).weekday; // 0 Sun - 6 Sat
  const diffDays = weekday === 0 ? -6 : 1 - weekday;
  const p = getZonedParts(start, timeZone);
  return zonedPartsToUtc({ year: p.year, month: p.month, day: p.day + diffDays, hour: 0, minute: 0, second: 0 }, timeZone);
}

/** End of the Monday-first week containing `date`, in `timeZone`. */
export function endOfWeekInTz(date: Date, timeZone: string): Date {
  const start = startOfWeekInTz(date, timeZone);
  const p = getZonedParts(start, timeZone);
  return endOfDayInTz(
    zonedPartsToUtc({ year: p.year, month: p.month, day: p.day + 6, hour: 12, minute: 0, second: 0 }, timeZone),
    timeZone,
  );
}
