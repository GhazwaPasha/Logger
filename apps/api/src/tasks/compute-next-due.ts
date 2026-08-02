import { getZonedParts, zonedPartsToUtc, type ZonedParts } from "@work-ledger/contracts";

export type DueRepeatCadence = "daily" | "weekly" | "monthly" | "yearly";

export function isDueRepeat(v: string | null | undefined): v is DueRepeatCadence {
  return v === "daily" || v === "weekly" || v === "monthly" || v === "yearly";
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addMonthsPreserveDay(p: ZonedParts, months: number): ZonedParts {
  const totalMonths = p.month - 1 + months;
  const year = p.year + Math.floor(totalMonths / 12);
  const month = (((totalMonths % 12) + 12) % 12) + 1;
  const day = Math.min(p.day, daysInMonth(year, month));
  return { ...p, year, month, day };
}

/** Next occurrence instant after `from`, using the org's calendar (matches typical due-date UX —
 *  "every day at 9am" should mean 9am in the org's own timezone, not the API server's). */
export function computeNextDue(from: Date, repeat: DueRepeatCadence, timeZone: string): Date {
  const parts = getZonedParts(from, timeZone);
  switch (repeat) {
    case "daily":
      return zonedPartsToUtc(addDays(parts, 1), timeZone);
    case "weekly":
      return zonedPartsToUtc(addDays(parts, 7), timeZone);
    case "monthly":
      return zonedPartsToUtc(addMonthsPreserveDay(parts, 1), timeZone);
    case "yearly":
      return zonedPartsToUtc(addMonthsPreserveDay(parts, 12), timeZone);
    default:
      return new Date(from.getTime());
  }
}

function addDays(p: ZonedParts, days: number): ZonedParts {
  const asUtcMidnight = Date.UTC(p.year, p.month - 1, p.day + days);
  const d = new Date(asUtcMidnight);
  return { ...p, year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}
