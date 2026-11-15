import type { TrackerDetail, TrackerEntry, TrackerMetric, TrackerSummary } from "@work-ledger/contracts";

/**
 * Compact, model-friendly shape of a tracker for the Ask agent and MCP clients: the numbers that
 * answer "how is X doing?" without the full per-slot grid (every byte is tokens in the caller's context).
 */
export function digestTracker(t: TrackerSummary, names?: Map<string, string>) {
  const per = t.split === "week" ? "week" : "day";
  return {
    id: t.id,
    name: t.name,
    assigneeId: t.assigneeId,
    ...(names ? { assignee: names.get(t.assigneeId) ?? "Unknown" } : {}),
    period: { start: t.periodStart, end: t.periodEnd, phase: t.stats.phase },
    logs: t.checkIn,
    targetSplit: per,
    workingDays: t.workingDays,
    reminderTime: t.reminderTime,
    archived: Boolean(t.archivedAt),
    status: t.stats.pace,
    progress: `${t.stats.elapsedUnits}/${t.stats.totalUnits} ${per}s`,
    missedLogs: t.stats.missedCount,
    today: t.stats.dueKey ? { slot: t.stats.dueKey, logged: t.stats.dueLogged } : null,
    metrics: t.metrics.map((m, i) => digestMetric(m, t.stats.metrics[i], per, t.metrics)),
  };
}

function round(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return null;
  return Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 100) / 100;
}

function digestMetric(
  m: TrackerMetric,
  s: TrackerSummary["stats"]["metrics"][number] | undefined,
  per: "day" | "week",
  all: TrackerMetric[],
) {
  const base = {
    id: m.id,
    name: m.name,
    kind: m.kind,
    unit: m.unit,
    target: round(m.target),
    direction: m.direction,
    value: round(s?.value),
    pace: s?.pace ?? "none",
  };
  if (m.kind === "formula" && m.formula) {
    const a = all.find((x) => x.id === m.formula!.a)?.name ?? "?";
    const b = all.find((x) => x.id === m.formula!.b)?.name ?? "?";
    const op = { div: "/", mul: "*", add: "+", sub: "-" }[m.formula.op];
    return { ...base, formula: `${a} ${op} ${b}${m.formula.percent ? " * 100" : ""}` };
  }
  return {
    ...base,
    expectedByNow: round(s?.expected),
    aheadBy: round(s?.delta),
    neededPerRemaining: s?.neededPerUnit != null ? { amount: round(s.neededPerUnit), per } : null,
  };
}

/** Recent logs as `{ date, values: { MetricName: n }, note }`, newest first. */
export function digestEntries(detail: TrackerDetail, limit: number) {
  const nameOf = new Map(detail.metrics.map((m) => [m.id, m.name]));
  return detail.entries.slice(0, limit).map((e: TrackerEntry) => ({
    date: e.entryDate,
    loggedBy: e.userId,
    values: Object.fromEntries(Object.entries(e.values).map(([id, v]) => [nameOf.get(id) ?? id, v])),
    note: e.note,
  }));
}

/** Finds a metric by id or by name (case-insensitive) — AI clients usually know the name. */
export function findMetric(metrics: TrackerMetric[], key: string): TrackerMetric | undefined {
  const k = key.trim().toLowerCase();
  return metrics.find((m) => m.id === key) ?? metrics.find((m) => m.name.trim().toLowerCase() === k);
}
