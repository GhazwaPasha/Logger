export type DueRepeatCadence = "daily" | "weekly" | "monthly" | "yearly";

export function isDueRepeat(v: string | null | undefined): v is DueRepeatCadence {
  return v === "daily" || v === "weekly" || v === "monthly" || v === "yearly";
}

function addMonthsPreserveDay(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() !== day) {
    d.setDate(0);
  }
  return d;
}

/** Next occurrence instant after `from`, using local calendar semantics (matches typical due-date UX). */
export function computeNextDue(from: Date, repeat: DueRepeatCadence): Date {
  switch (repeat) {
    case "daily": {
      const d = new Date(from.getTime());
      d.setDate(d.getDate() + 1);
      return d;
    }
    case "weekly": {
      const d = new Date(from.getTime());
      d.setDate(d.getDate() + 7);
      return d;
    }
    case "monthly":
      return addMonthsPreserveDay(from, 1);
    case "yearly":
      return addMonthsPreserveDay(from, 12);
    default:
      return new Date(from.getTime());
  }
}
