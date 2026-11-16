"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertTrackerEntrySchema = exports.updateTrackerSchema = exports.createTrackerSchema = exports.trackerMetricInputSchema = exports.trackerFormulaSchema = exports.trackerDirectionSchema = exports.trackerMetricUnitSchema = exports.trackerMetricKindSchema = exports.trackerCheckInSchema = exports.trackerSplitSchema = void 0;
exports.addDaysToKey = addDaysToKey;
exports.isoWeekday = isoWeekday;
exports.weekStartKey = weekStartKey;
exports.trackerSlotKey = trackerSlotKey;
exports.trackerSlotKeys = trackerSlotKeys;
exports.applyTrackerFormula = applyTrackerFormula;
exports.computeTrackerStats = computeTrackerStats;
const zod_1 = require("zod");
/**
 * Trackers: one person, a set of metrics with whole-period targets, and daily/weekly check-ins.
 * Everything date-shaped here is a workspace-local `YYYY-MM-DD` key, so the maths never touches time zones.
 * The pace engine (`computeTrackerStats`) is pure and shared by the API, web, and mobile.
 */
const dateKey = zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
exports.trackerSplitSchema = zod_1.z.enum(["day", "week"]);
exports.trackerCheckInSchema = zod_1.z.enum(["daily", "weekly"]);
exports.trackerMetricKindSchema = zod_1.z.enum(["input", "formula"]);
exports.trackerMetricUnitSchema = zod_1.z.enum(["count", "number", "currency", "percent"]);
exports.trackerDirectionSchema = zod_1.z.enum(["at_least", "at_most"]);
exports.trackerFormulaSchema = zod_1.z.object({
    op: zod_1.z.enum(["div", "mul", "add", "sub"]),
    a: zod_1.z.string().uuid(),
    b: zod_1.z.string().uuid(),
    /** Multiply the result by 100 (e.g. a conversion rate). */
    percent: zod_1.z.boolean().optional(),
});
exports.trackerMetricInputSchema = zod_1.z
    .object({
    /** Client-generated so formulas can reference sibling metrics before they exist. */
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string().trim().min(1).max(80),
    kind: exports.trackerMetricKindSchema.default("input"),
    unit: exports.trackerMetricUnitSchema.default("count"),
    currency: zod_1.z.string().trim().max(8).nullable().optional(),
    formula: exports.trackerFormulaSchema.nullable().optional(),
    target: zod_1.z.number().finite().nonnegative().nullable().optional(),
    direction: exports.trackerDirectionSchema.default("at_least"),
})
    .refine((m) => (m.kind === "formula" ? Boolean(m.formula) : !m.formula), {
    message: "Calculated metrics need a formula; logged metrics can't have one",
});
const workingDaysSchema = zod_1.z
    .array(zod_1.z.number().int().min(1).max(7))
    .min(1, "Pick at least one working day")
    .max(7)
    .transform((d) => [...new Set(d)].sort());
const reminderSchema = zod_1.z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm")
    .nullable()
    .optional();
function validateMetrics(metrics, ctx) {
    const ids = new Set(metrics.map((m) => m.id));
    if (ids.size !== metrics.length)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "Duplicate metric ids" });
    const inputs = new Set(metrics.filter((m) => m.kind === "input").map((m) => m.id));
    if (inputs.size === 0)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "Add at least one metric to log" });
    for (const m of metrics) {
        if (!m.formula)
            continue;
        if (!inputs.has(m.formula.a) || !inputs.has(m.formula.b) || m.formula.a === m.formula.b) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: `“${m.name}” must be calculated from two different logged metrics`,
            });
        }
    }
}
exports.createTrackerSchema = zod_1.z
    .object({
    name: zod_1.z.string().trim().min(1).max(120),
    /** Optional: a tracker can be set up first and given to someone later. */
    assigneeId: zod_1.z.string().min(1).nullable().optional(),
    periodStart: dateKey,
    periodEnd: dateKey,
    split: exports.trackerSplitSchema.default("day"),
    checkIn: exports.trackerCheckInSchema.default("daily"),
    workingDays: workingDaysSchema.default([1, 2, 3, 4, 5, 6, 7]),
    reminderTime: reminderSchema,
    metrics: zod_1.z.array(exports.trackerMetricInputSchema).min(1).max(12),
})
    .superRefine((t, ctx) => {
    if (t.periodEnd < t.periodStart) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "The period ends before it starts", path: ["periodEnd"] });
    }
    validateMetrics(t.metrics, ctx);
});
exports.updateTrackerSchema = zod_1.z
    .object({
    name: zod_1.z.string().trim().min(1).max(120).optional(),
    /** null unassigns. */
    assigneeId: zod_1.z.string().min(1).nullable().optional(),
    periodStart: dateKey.optional(),
    periodEnd: dateKey.optional(),
    split: exports.trackerSplitSchema.optional(),
    checkIn: exports.trackerCheckInSchema.optional(),
    workingDays: workingDaysSchema.optional(),
    reminderTime: reminderSchema,
    archived: zod_1.z.boolean().optional(),
    /** Full replacement: metrics left out are deleted along with their logged values. */
    metrics: zod_1.z.array(exports.trackerMetricInputSchema).min(1).max(12).optional(),
})
    .superRefine((t, ctx) => {
    if (t.periodStart && t.periodEnd && t.periodEnd < t.periodStart) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "The period ends before it starts", path: ["periodEnd"] });
    }
    if (t.metrics)
        validateMetrics(t.metrics, ctx);
});
exports.upsertTrackerEntrySchema = zod_1.z.object({
    /** metricId → value; only `input` metrics are accepted. */
    values: zod_1.z.record(zod_1.z.string().uuid(), zod_1.z.number().finite()),
    note: zod_1.z.string().trim().max(1000).nullable().optional(),
});
/* ───────────────────────── Date helpers ───────────────────────── */
function toUtc(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
}
function fromUtc(d) {
    return d.toISOString().slice(0, 10);
}
function addDaysToKey(key, days) {
    const d = toUtc(key);
    d.setUTCDate(d.getUTCDate() + days);
    return fromUtc(d);
}
/** ISO weekday: 1 = Monday … 7 = Sunday. */
function isoWeekday(key) {
    const w = toUtc(key).getUTCDay();
    return w === 0 ? 7 : w;
}
/** Monday of the week containing `key`. */
function weekStartKey(key) {
    return addDaysToKey(key, 1 - isoWeekday(key));
}
function workingDayKeys(start, end, workingDays) {
    const out = [];
    const days = new Set(workingDays);
    for (let k = start; k <= end; k = addDaysToKey(k, 1))
        if (days.has(isoWeekday(k)))
            out.push(k);
    return out;
}
function weekKeys(start, end) {
    const out = [];
    for (let k = weekStartKey(start); k <= end; k = addDaysToKey(k, 7))
        out.push(k);
    return out;
}
/** The slot an entry made on `day` belongs to. */
function trackerSlotKey(checkIn, day) {
    return checkIn === "weekly" ? weekStartKey(day) : day;
}
/** Every check-in slot in the period (working days, or week starts). */
function trackerSlotKeys(t) {
    return t.checkIn === "weekly"
        ? weekKeys(t.periodStart, t.periodEnd)
        : workingDayKeys(t.periodStart, t.periodEnd, t.workingDays);
}
/* ───────────────────────── Pace engine ───────────────────────── */
function applyTrackerFormula(f, a, b) {
    let v;
    switch (f.op) {
        case "div":
            if (b === 0)
                return null;
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
function computeTrackerStats(t, metrics, entries, today) {
    const phase = today < t.periodStart ? "upcoming" : today > t.periodEnd ? "ended" : "active";
    // Pace units (how the target is sliced).
    const units = t.split === "week" ? weekKeys(t.periodStart, t.periodEnd) : workingDayKeys(t.periodStart, t.periodEnd, t.workingDays);
    const totalUnits = Math.max(1, units.length);
    const loggedSlots = new Set(entries.map((e) => e.entryDate));
    const currentUnit = t.split === "week" ? weekStartKey(today) : today;
    // A unit counts once it is over, or as soon as the current one has been logged — so logging today
    // moves the goalposts by exactly today's slice instead of making the assignee look behind all morning.
    const currentLogged = entries.some((e) => t.split === "week" ? weekStartKey(e.entryDate) === currentUnit : e.entryDate === currentUnit);
    let elapsedUnits = units.filter((u) => u < currentUnit).length;
    if (units.includes(currentUnit) && currentLogged)
        elapsedUnits += 1;
    elapsedUnits = Math.min(totalUnits, elapsedUnits);
    const progress = elapsedUnits / totalUnits;
    const remainingUnits = totalUnits - elapsedUnits;
    const sums = new Map();
    for (const e of entries)
        for (const [id, v] of Object.entries(e.values))
            sums.set(id, (sums.get(id) ?? 0) + v);
    const metricStats = metrics.map((m) => {
        if (m.kind === "formula" && m.formula) {
            const value = applyTrackerFormula(m.formula, sums.get(m.formula.a) ?? 0, sums.get(m.formula.b) ?? 0);
            let pace = "none";
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
        let pace;
        if (phase === "ended") {
            const ok = m.direction === "at_most" ? value <= m.target : value >= m.target;
            pace = ok ? "met" : "missed";
        }
        else if (m.direction === "at_least" && value >= m.target)
            pace = "met";
        else if (m.direction === "at_most" && value > m.target)
            pace = "missed";
        else
            pace = delta > tol ? "ahead" : delta < -tol ? "behind" : "on_pace";
        const neededPerUnit = m.direction === "at_least" && remainingUnits > 0 ? Math.max(0, m.target - value) / remainingUnits : null;
        return { metricId: m.id, value, target: m.target, expected, delta, slice, neededPerUnit, pace };
    });
    const rank = { missed: 0, behind: 1, on_pace: 2, ahead: 3, met: 4, none: 5 };
    const graded = metricStats.filter((s, i) => metrics[i].kind === "input" && s.pace !== "none");
    const pace = graded.length ? graded.reduce((w, s) => (rank[s.pace] < rank[w] ? s.pace : w), "none") : "none";
    // Check-in slots.
    const slotKeys = trackerSlotKeys(t);
    const todaySlot = trackerSlotKey(t.checkIn, today);
    const dueKey = phase === "active" && slotKeys.includes(todaySlot) ? todaySlot : null;
    const slots = slotKeys.map((key) => {
        if (loggedSlots.has(key))
            return { key, state: "logged" };
        if (key === dueKey)
            return { key, state: "due" };
        if (key < todaySlot)
            return { key, state: "missed" };
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
