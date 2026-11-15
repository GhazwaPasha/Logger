import { z } from "zod";

/**
 * Trackers: one person, a set of metrics with whole-period targets, and daily/weekly check-ins.
 * Everything date-shaped here is a workspace-local `YYYY-MM-DD` key, so the maths never touches time zones.
 * The pace engine (`computeTrackerStats`) is pure and shared by the API, web, and mobile.
 */

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const trackerSplitSchema = z.enum(["day", "week"]);
export const trackerCheckInSchema = z.enum(["daily", "weekly"]);
export const trackerMetricKindSchema = z.enum(["input", "formula"]);
export const trackerMetricUnitSchema = z.enum(["count", "number", "currency", "percent"]);
export const trackerDirectionSchema = z.enum(["at_least", "at_most"]);
export const trackerFormulaSchema = z.object({
  op: z.enum(["div", "mul", "add", "sub"]),
  a: z.string().uuid(),
  b: z.string().uuid(),
  /** Multiply the result by 100 (e.g. a conversion rate). */
  percent: z.boolean().optional(),
});

export type TrackerSplit = z.infer<typeof trackerSplitSchema>;
export type TrackerCheckIn = z.infer<typeof trackerCheckInSchema>;
export type TrackerMetricUnit = z.infer<typeof trackerMetricUnitSchema>;
export type TrackerDirection = z.infer<typeof trackerDirectionSchema>;
export type TrackerFormula = z.infer<typeof trackerFormulaSchema>;

export const trackerMetricInputSchema = z
  .object({
    /** Client-generated so formulas can reference sibling metrics before they exist. */
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(80),
    kind: trackerMetricKindSchema.default("input"),
    unit: trackerMetricUnitSchema.default("count"),
    currency: z.string().trim().max(8).nullable().optional(),
    formula: trackerFormulaSchema.nullable().optional(),
    target: z.number().finite().nonnegative().nullable().optional(),
    direction: trackerDirectionSchema.default("at_least"),
  })
  .refine((m) => (m.kind === "formula" ? Boolean(m.formula) : !m.formula), {
    message: "Calculated metrics need a formula; logged metrics can't have one",
  });

const workingDaysSchema = z
  .array(z.number().int().min(1).max(7))
  .min(1, "Pick at least one working day")
  .max(7)
  .transform((d) => [...new Set(d)].sort());

const reminderSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm")
  .nullable()
  .optional();

function validateMetrics(
  metrics: z.infer<typeof trackerMetricInputSchema>[],
  ctx: z.RefinementCtx,
) {
  const ids = new Set(metrics.map((m) => m.id));
  if (ids.size !== metrics.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate metric ids" });
  const inputs = new Set(metrics.filter((m) => m.kind === "input").map((m) => m.id));
  if (inputs.size === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Add at least one metric to log" });
  for (const m of metrics) {
    if (!m.formula) continue;
    if (!inputs.has(m.formula.a) || !inputs.has(m.formula.b) || m.formula.a === m.formula.b) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `“${m.name}” must be calculated from two different logged metrics`,
      });
    }
  }
}

export const createTrackerSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    assigneeId: z.string().min(1),
    periodStart: dateKey,
    periodEnd: dateKey,
    split: trackerSplitSchema.default("day"),
    checkIn: trackerCheckInSchema.default("daily"),
    workingDays: workingDaysSchema.default([1, 2, 3, 4, 5]),
    reminderTime: reminderSchema,
    metrics: z.array(trackerMetricInputSchema).min(1).max(12),
  })
  .superRefine((t, ctx) => {
    if (t.periodEnd < t.periodStart) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "The period ends before it starts", path: ["periodEnd"] });
    }
    validateMetrics(t.metrics, ctx);
  });

export const updateTrackerSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    assigneeId: z.string().min(1).optional(),
    periodStart: dateKey.optional(),
    periodEnd: dateKey.optional(),
    split: trackerSplitSchema.optional(),
    checkIn: trackerCheckInSchema.optional(),
    workingDays: workingDaysSchema.optional(),
    reminderTime: reminderSchema,
    archived: z.boolean().optional(),
    /** Full replacement: metrics left out are deleted along with their logged values. */
    metrics: z.array(trackerMetricInputSchema).min(1).max(12).optional(),
  })
  .superRefine((t, ctx) => {
    if (t.periodStart && t.periodEnd && t.periodEnd < t.periodStart) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "The period ends before it starts", path: ["periodEnd"] });
    }
    if (t.metrics) validateMetrics(t.metrics, ctx);
  });

export const upsertTrackerEntrySchema = z.object({
  /** metricId → value; only `input` metrics are accepted. */
  values: z.record(z.string().uuid(), z.number().finite()),
  note: z.string().trim().max(1000).nullable().optional(),
});

export type CreateTrackerInput = z.input<typeof createTrackerSchema>;
export type UpdateTrackerInput = z.input<typeof updateTrackerSchema>;
export type UpsertTrackerEntryInput = z.input<typeof upsertTrackerEntrySchema>;

/* ───────────────────────── Wire types ───────────────────────── */

export type TrackerMetric = {
  id: string;
  name: string;
  kind: "input" | "formula";
  unit: TrackerMetricUnit;
  currency: string | null;
  formula: TrackerFormula | null;
  target: number | null;
  direction: TrackerDirection;
  orderIndex: number;
};

export type TrackerEntry = {
  id: string;
  entryDate: string;
  userId: string;
  note: string | null;
  values: Record<string, number>;
  updatedAt: string;
};

export type TrackerConfig = {
  periodStart: string;
  periodEnd: string;
  split: TrackerSplit;
  checkIn: TrackerCheckIn;
  workingDays: number[];
};

export type TrackerRow = TrackerConfig & {
  id: string;
  organizationId: string;
  name: string;
  assigneeId: string;
  createdBy: string;
  reminderTime: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TrackerPace = "ahead" | "on_pace" | "behind" | "met" | "missed" | "none";

export type TrackerMetricStats = {
  metricId: string;
  /** Sum of logged values (input) or the formula applied to the sums (formula). Null when undefined (e.g. ÷ 0). */
  value: number | null;
  target: number | null;
  /** Where the total should be by now, for input metrics with a target. */
  expected: number | null;
  /** `value − expected`, signed so positive is always good. */
  delta: number | null;
  /** The target divided evenly over the split units. */
  slice: number | null;
  /** What each remaining unit now needs to finish on target (input, at_least only). */
  neededPerUnit: number | null;
  pace: TrackerPace;
};

export type TrackerSlotState = "logged" | "missed" | "due" | "upcoming";
export type TrackerSlot = { key: string; state: TrackerSlotState };

export type TrackerStats = {
  today: string;
  /** Before the period, inside it, or after it ended. */
  phase: "upcoming" | "active" | "ended";
  totalUnits: number;
  elapsedUnits: number;
  /** Fraction of the period that has elapsed (0–1). */
  progress: number;
  metrics: TrackerMetricStats[];
  /** Overall status: the worst pace across input metrics with targets. */
  pace: TrackerPace;
  /** Every check-in slot from the start to today (plus the rest as `upcoming`). */
  slots: TrackerSlot[];
  missedCount: number;
  /** The slot the assignee should log now, if any (today, or this week's Monday). */
  dueKey: string | null;
  dueLogged: boolean;
};

export type TrackerSummary = TrackerRow & {
  metrics: TrackerMetric[];
  stats: TrackerStats;
  /** The entry already logged for the current slot, so a check-in form can be prefilled. */
  dueEntry: TrackerEntry | null;
};
export type TrackerDetail = TrackerSummary & { entries: TrackerEntry[] };

/* ───────────────────────── Date helpers ───────────────────────── */

function toUtc(key: string): Date {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}
function fromUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function addDaysToKey(key: string, days: number): string {
  const d = toUtc(key);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}
/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(key: string): number {
  const w = toUtc(key).getUTCDay();
  return w === 0 ? 7 : w;
}
/** Monday of the week containing `key`. */
export function weekStartKey(key: string): string {
  return addDaysToKey(key, 1 - isoWeekday(key));
}

function workingDayKeys(start: string, end: string, workingDays: number[]): string[] {
  const out: string[] = [];
  const days = new Set(workingDays);
  for (let k = start; k <= end; k = addDaysToKey(k, 1)) if (days.has(isoWeekday(k))) out.push(k);
  return out;
}
function weekKeys(start: string, end: string): string[] {
  const out: string[] = [];
  for (let k = weekStartKey(start); k <= end; k = addDaysToKey(k, 7)) out.push(k);
  return out;
}

/** The slot an entry made on `day` belongs to. */
export function trackerSlotKey(checkIn: TrackerCheckIn, day: string): string {
  return checkIn === "weekly" ? weekStartKey(day) : day;
}

/** Every check-in slot in the period (working days, or week starts). */
export function trackerSlotKeys(t: TrackerConfig): string[] {
  return t.checkIn === "weekly"
    ? weekKeys(t.periodStart, t.periodEnd)
    : workingDayKeys(t.periodStart, t.periodEnd, t.workingDays);
}

/* ───────────────────────── Pace engine ───────────────────────── */

export function applyTrackerFormula(f: TrackerFormula, a: number, b: number): number | null {
  let v: number;
  switch (f.op) {
    case "div":
      if (b === 0) return null;
      v = a / b;
      break;
    case "mul":
      v = a * b;
      break;
    case "add":
      v = a + b;
      break;
    case "sub":
      v = a - b;
      break;
  }
  return f.percent ? v * 100 : v;
}

/** Within this share of the target counts as "on pace" rather than ahead/behind. */
const PACE_TOLERANCE = 0.02;

export function computeTrackerStats(
  t: TrackerConfig,
  metrics: TrackerMetric[],
  entries: Pick<TrackerEntry, "entryDate" | "values">[],
  today: string,
): TrackerStats {
  const phase = today < t.periodStart ? "upcoming" : today > t.periodEnd ? "ended" : "active";

  // Pace units (how the target is sliced).
  const units = t.split === "week" ? weekKeys(t.periodStart, t.periodEnd) : workingDayKeys(t.periodStart, t.periodEnd, t.workingDays);
  const totalUnits = Math.max(1, units.length);
  const loggedSlots = new Set(entries.map((e) => e.entryDate));
  const currentUnit = t.split === "week" ? weekStartKey(today) : today;
  // A unit counts once it is over, or as soon as the current one has been logged — so logging today
  // moves the goalposts by exactly today's slice instead of making the assignee look behind all morning.
  const currentLogged = entries.some((e) =>
    t.split === "week" ? weekStartKey(e.entryDate) === currentUnit : e.entryDate === currentUnit,
  );
  let elapsedUnits = units.filter((u) => u < currentUnit).length;
  if (units.includes(currentUnit) && currentLogged) elapsedUnits += 1;
  elapsedUnits = Math.min(totalUnits, elapsedUnits);
  const progress = elapsedUnits / totalUnits;
  const remainingUnits = totalUnits - elapsedUnits;

  const sums = new Map<string, number>();
  for (const e of entries) for (const [id, v] of Object.entries(e.values)) sums.set(id, (sums.get(id) ?? 0) + v);

  const metricStats: TrackerMetricStats[] = metrics.map((m) => {
    if (m.kind === "formula" && m.formula) {
      const value = applyTrackerFormula(m.formula, sums.get(m.formula.a) ?? 0, sums.get(m.formula.b) ?? 0);
      let pace: TrackerPace = "none";
      if (m.target != null && value != null) {
        const ok = m.direction === "at_most" ? value <= m.target : value >= m.target;
        pace = ok ? "met" : phase === "ended" ? "missed" : "behind";
      }
      return { metricId: m.id, value, target: m.target, expected: null, delta: null, slice: null, neededPerUnit: null, pace };
    }
    const value = sums.get(m.id) ?? 0;
    if (m.target == null) {
      return { metricId: m.id, value, target: null, expected: null, delta: null, slice: null, neededPerUnit: null, pace: "none" };
    }
    const slice = m.target / totalUnits;
    const expected = m.target * progress;
    const delta = m.direction === "at_most" ? expected - value : value - expected;
    const tol = m.target * PACE_TOLERANCE;
    let pace: TrackerPace;
    if (phase === "ended") {
      const ok = m.direction === "at_most" ? value <= m.target : value >= m.target;
      pace = ok ? "met" : "missed";
    } else if (m.direction === "at_least" && value >= m.target) pace = "met";
    else if (m.direction === "at_most" && value > m.target) pace = "missed";
    else pace = delta > tol ? "ahead" : delta < -tol ? "behind" : "on_pace";
    const neededPerUnit =
      m.direction === "at_least" && remainingUnits > 0 ? Math.max(0, m.target - value) / remainingUnits : null;
    return { metricId: m.id, value, target: m.target, expected, delta, slice, neededPerUnit, pace };
  });

  const rank: Record<TrackerPace, number> = { missed: 0, behind: 1, on_pace: 2, ahead: 3, met: 4, none: 5 };
  const graded = metricStats.filter((s, i) => metrics[i]!.kind === "input" && s.pace !== "none");
  const pace = graded.length ? graded.reduce((w, s) => (rank[s.pace] < rank[w] ? s.pace : w), "none" as TrackerPace) : "none";

  // Check-in slots.
  const slotKeys = trackerSlotKeys(t);
  const todaySlot = trackerSlotKey(t.checkIn, today);
  const dueKey = phase === "active" && slotKeys.includes(todaySlot) ? todaySlot : null;
  const slots: TrackerSlot[] = slotKeys.map((key) => {
    if (loggedSlots.has(key)) return { key, state: "logged" };
    if (key === dueKey) return { key, state: "due" };
    if (key < todaySlot) return { key, state: "missed" };
    return { key, state: "upcoming" };
  });

  return {
    today,
    phase,
    totalUnits,
    elapsedUnits,
    progress,
    metrics: metricStats,
    pace,
    slots,
    missedCount: slots.filter((s) => s.state === "missed").length,
    dueKey,
    dueLogged: dueKey ? loggedSlots.has(dueKey) : false,
  };
}
