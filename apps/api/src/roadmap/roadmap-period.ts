const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export type GeneratedChild = { title: string; periodStart: Date; periodEnd: Date };

function endOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

/** Calendar-year quarters covering the year that `yearStart` falls in. */
export function computeQuarters(yearStart: Date): GeneratedChild[] {
  const year = yearStart.getUTCFullYear();
  const bounds = [0, 3, 6, 9, 12].map((m) => new Date(Date.UTC(year, m, 1)));
  return [0, 1, 2, 3].map((i) => ({
    title: `Q${i + 1} ${year}`,
    periodStart: bounds[i]!,
    periodEnd: endOfDayUtc(new Date(bounds[i + 1]!.getTime() - 1)),
  }));
}

/** The 3 calendar months of the quarter that `quarterStart` falls in. */
export function computeMonths(quarterStart: Date): GeneratedChild[] {
  const year = quarterStart.getUTCFullYear();
  const startMonth = quarterStart.getUTCMonth();
  return [0, 1, 2].map((i) => {
    const m = startMonth + i;
    const start = new Date(Date.UTC(year, m, 1));
    const end = endOfDayUtc(new Date(Date.UTC(year, m + 1, 1) - 1));
    return { title: `${MONTH_NAMES[start.getUTCMonth()]} ${start.getUTCFullYear()}`, periodStart: start, periodEnd: end };
  });
}

/** Monday-start weeks spanning the calendar month that [monthStart, monthEnd] represents, clipped to the month. */
export function computeWeeks(monthStart: Date, monthEnd: Date): GeneratedChild[] {
  const weeks: GeneratedChild[] = [];
  const dow = monthStart.getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (dow + 6) % 7;
  let cursor = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), monthStart.getUTCDate() - daysSinceMonday));

  while (cursor.getTime() <= monthEnd.getTime()) {
    const weekEnd = new Date(cursor.getTime() + 6 * 24 * 60 * 60 * 1000);
    const clippedStart = cursor.getTime() < monthStart.getTime() ? monthStart : cursor;
    const clippedEnd = endOfDayUtc(weekEnd.getTime() > monthEnd.getTime() ? monthEnd : weekEnd);
    weeks.push({
      title: `Week of ${MONTH_NAMES[clippedStart.getUTCMonth()]!.slice(0, 3)} ${clippedStart.getUTCDate()}`,
      periodStart: clippedStart,
      periodEnd: clippedEnd,
    });
    cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  return weeks;
}
