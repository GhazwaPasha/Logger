"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  applyTrackerFormula,
  type TrackerEntry,
  type TrackerMetric,
  type TrackerMetricStats,
} from "@work-ledger/contracts";
import type { TrackerDetailResponse } from "@/hooks/useTrackers";
import type { MemberRow } from "@/lib/ledger-types";
import { SpringNumber } from "./SpringNumber";
import { Calculator, ChevronDown } from "lucide-react";
import { Collapse } from "@/components/ui/Collapse";
import { SmoothLineChart } from "@/components/dashboard/SmoothLineChart";
import { Segmented } from "@/components/ui/Segmented";
import { Avatar } from "@/components/ui/Avatar";
import { SelectPopover } from "@/components/ui/SelectPopover";
import {
  PACE_LABEL,
  PACE_TEXT,
  dayLabel,
  fullNumber,
  metricValue,
  periodLabel,
} from "./tracker-format";

/** Pace pill fill + ink. Missed check-ins are amber (needs attention), behind is red. */
const PACE_PILL: Record<string, string> = {
  behind: "bg-[color-mix(in_srgb,var(--danger)_13%,transparent)] text-[var(--danger)]",
  missed: "bg-[var(--status-progress-bg)] text-[var(--status-progress-ink)]",
  on_pace: "bg-[var(--status-done-bg)] text-[var(--status-done-ink)]",
  ahead: "bg-[var(--status-done-bg)] text-[var(--status-done-ink)]",
  met: "bg-[var(--status-done-bg)] text-[var(--status-done-ink)]",
  none: "bg-[var(--fill-2)] text-[var(--muted)]",
};
/** Metric tiles take the department tints in a fixed order (input metrics only). */
const TILE_TINTS = ["var(--dept-1-tint)", "var(--dept-3-tint)", "var(--dept-4-tint)", "var(--dept-2-tint)"];

function memberName(members: MemberRow[], id: string | null) {
  if (!id) return "Unassigned";
  const m = members.find((x) => x.userId === id);
  return (m?.name ?? "").trim() || (m?.email ?? "").trim() || "Someone";
}

/** One line under each metric telling the assignee what to do next. */
/**
 * A metric tile's status line. `short` is what the tile shows — a few words that fit one line
 * ("267 behind · 104/day"); the long form is the tooltip, spelled out.
 */
function metricNote(m: TrackerMetric, s: TrackerMetricStats, metrics: TrackerMetric[], unitWord: string, short = true): string {
  if (m.kind === "formula" && m.formula) {
    const a = metrics.find((x) => x.id === m.formula!.a)?.name ?? "?";
    const b = metrics.find((x) => x.id === m.formula!.b)?.name ?? "?";
    const sym = { div: "÷", mul: "×", add: "+", sub: "−" }[m.formula.op];
    return `${a} ${sym} ${b}${m.formula.percent ? " × 100" : ""}`;
  }
  if (s.target == null) return "No target";
  if (s.pace === "met") return "Target met";
  if (s.pace === "missed") return m.direction === "at_most" ? (short ? "Over limit" : "Over the limit") : short ? "Missed" : "Target missed";
  const d = Math.abs(s.delta ?? 0);
  const fmt = (v: number) => metricValue(m, v);
  // Per-day needs read better whole once they're big enough to count ("104", not "104.3").
  const perUnit = (v: number) => metricValue(m, v >= 10 ? Math.ceil(v) : Math.round(v * 10) / 10);
  if (s.pace === "behind") {
    if (short) return s.neededPerUnit != null ? `${fmt(d)} behind · ${perUnit(s.neededPerUnit)}/${unitWord === "week" ? "wk" : "day"}` : `${fmt(d)} behind`;
    const need = s.neededPerUnit != null ? ` · need ${fmt(s.neededPerUnit)} a ${unitWord} to catch up` : "";
    return `${fmt(d)} behind pace${need}`;
  }
  if (s.pace === "ahead") return short ? `${fmt(d)} ahead` : `${fmt(d)} ahead of pace`;
  return "On pace";
}

export function TrackerDetail({
  detail,
  members,
  currentUserId,
  onEdit,
  onLog,
}: {
  detail: TrackerDetailResponse;
  members: MemberRow[];
  currentUserId: string | null;
  onEdit: () => void;
  onLog: (date: string, values: Record<string, number>, note: string | null) => Promise<unknown>;
}) {
  const { stats, metrics } = detail;
  // The day the Log progress panel is on. Clicking a square or a past log moves it there.
  const [picked, setPicked] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<"cumulative" | "per">("cumulative");

  // Logging needs someone to log for: an unassigned tracker shows its targets but takes no logs yet.
  const canLog =
    !detail.archivedAt && Boolean(detail.assigneeId) && (detail.canManage || detail.assigneeId === currentUserId);
  const unitWord = detail.split === "week" ? "week" : "day";
  const entriesByKey = useMemo(() => new Map(detail.entries.map((e) => [e.entryDate, e])), [detail.entries]);
  const firstOpen =
    stats.dueKey && !stats.dueLogged
      ? stats.dueKey
      : ([...stats.slots].reverse().find((s) => s.state === "missed")?.key ?? stats.dueKey);
  const logDate = picked ?? firstOpen ?? null;

  const assignee = detail.assigneeId ? members.find((x) => x.userId === detail.assigneeId) : undefined;
  const phaseLabel =
    stats.phase === "active"
      ? `${unitWord === "week" ? "Week" : "Day"} ${Math.min(stats.totalUnits, stats.elapsedUnits + 1)} of ${stats.totalUnits}`
      : stats.phase === "ended"
        ? "Ended"
        : "Not started";
  const missedFirst = stats.missedCount > 0 && stats.pace !== "behind";

  const cannotLogReason = detail.archivedAt
    ? "This tracker is archived."
    : !detail.assigneeId
      ? "Assign someone to this tracker to start logging."
      : stats.phase === "upcoming"
        ? `Logging opens on ${periodLabel(detail.periodStart, detail.periodStart).split(" – ")[0]}.`
        : `Only ${memberName(members, detail.assigneeId)} or a manager can log here.`;

  const paceKey = missedFirst ? "missed" : stats.pace;
  const unitsLeft = Math.max(0, stats.totalUnits - stats.elapsedUnits);

  return (
    <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start">
      {/* ───────────── Middle: the tracker's numbers ───────────── */}
      <div className="min-w-0 flex-1 space-y-5 rounded-[20px] bg-[var(--card)] p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-footnote text-[var(--muted)]">
              {assignee ? (
                <Avatar name={assignee.name} email={assignee.email} image={assignee.image} size="size-5" className="bg-[var(--fill-2)] text-2xs font-semibold text-[var(--fg)]" />
              ) : (
                <span className="size-5 shrink-0 rounded-full shadow-[inset_0_0_0_1px_var(--line-strong)]" />
              )}
              <span className="truncate">
                {memberName(members, detail.assigneeId)} · {detail.checkIn === "weekly" ? "logs weekly" : "logs daily"}
                {detail.reminderTime ? ` · reminder ${detail.reminderTime}` : ""}
              </span>
            </p>
            <h1 className="page-title mt-1 text-[var(--fg)]">{detail.name}</h1>
          </div>
          <span className={`inline-flex h-7 shrink-0 items-center rounded-full px-3 text-xs font-semibold ${PACE_PILL[paceKey]}`}>
            {missedFirst ? `${stats.missedCount} missed` : PACE_LABEL[stats.pace]}
          </span>
          {detail.canManage && (
            <button
              type="button"
              onClick={onEdit}
              className="pressable inline-flex h-7 shrink-0 items-center rounded-[9px] bg-[var(--fill-2)] px-3 text-xs font-semibold text-[var(--fg)] hover:bg-[var(--fill-3)]"
            >
              Edit
            </button>
          )}
        </div>

        {/* The line chart leads: its readout is the headline number (so far vs target, ahead/behind). */}
        <TrackerChart detail={detail} mode={chartMode} onModeChange={setChartMode} />

        {/* Period: one quiet line under the chart. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <span className="font-semibold text-[var(--muted)]">Period</span>
          <span className="font-semibold text-[var(--fg)]">{periodLabel(detail.periodStart, detail.periodEnd)}</span>
          <div className="h-1.5 min-w-[80px] flex-1 overflow-hidden rounded-full bg-[var(--fill-2)]">
            <div className="h-full rounded-r-[3px] bg-[var(--ink-2)]" style={{ width: `${Math.min(100, stats.progress * 100)}%` }} />
          </div>
          <span className="text-[var(--muted)]">
            {phaseLabel}
            {stats.phase === "active" ? ` · ${unitsLeft} ${unitWord}${unitsLeft === 1 ? "" : "s"} left` : ""}
          </span>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2.5">
          {metrics.map((m, i) => {
            const st = stats.metrics[i]!;
            return (
              <div
                key={m.id}
                className="min-w-0 rounded-2xl px-4 py-3.5"
                style={{ background: m.kind === "formula" ? "var(--fill)" : TILE_TINTS[i % TILE_TINTS.length] }}
              >
                <p className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
                  <span className="truncate" title={m.name}>{m.name}</span>
                  {m.kind === "formula" && (
                    <Calculator className="ml-auto size-3.5 shrink-0 opacity-70" aria-label="Calculated" role="img">
                      <title>Calculated</title>
                    </Calculator>
                  )}
                </p>
                <p className="mt-1.5 flex items-baseline gap-1.5">
                  <SpringNumber
                    value={st.value}
                    format={(v) => metricValue(m, v)}
                    className="font-outfit text-2xl font-semibold leading-none tracking-[-0.03em] text-[var(--fg)]"
                  />
                  {st.target != null && (
                    <span className="text-xs text-[var(--muted)]">
                      / {m.direction === "at_most" ? "≤ " : m.kind === "formula" ? "≥ " : ""}
                      {metricValue(m, st.target)}
                    </span>
                  )}
                </p>
                <p
                  className={`mt-1.5 truncate text-xs ${m.kind === "formula" && st.pace === "none" ? "text-[var(--muted)]" : PACE_TEXT[st.pace]}`}
                  title={metricNote(m, st, metrics, unitWord, false)}
                >
                  {metricNote(m, st, metrics, unitWord)}
                </p>
              </div>
            );
          })}
        </div>

        <div className="space-y-2.5">
          <div className="flex items-baseline justify-between">
            <h3 className="font-outfit text-base font-semibold text-[var(--fg)]">Check-ins</h3>
            <span className="text-xs text-[var(--muted)]">{stats.missedCount ? `${stats.missedCount} missed` : "No misses"}</span>
          </div>
          <CheckInStrip detail={detail} onPick={canLog ? (key) => setPicked(key) : undefined} selected={canLog ? logDate : null} />
          <p className="flex gap-4 text-xs text-[var(--muted)]">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-[var(--status-done)]" />Logged</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-[var(--danger)]" />Missed</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-[var(--status-progress)]" />Due</span>
          </p>
        </div>
      </div>

      {/* ───────────── Right: Log progress + recent logs, always in view ───────────── */}
      <aside className="w-full space-y-4 xl:sticky xl:top-4 xl:w-80 xl:shrink-0">
        <div className="space-y-4 rounded-[20px] bg-[var(--card)] p-5 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-outfit text-lg font-semibold text-[var(--fg)]">Log progress</h3>
            {stats.dueKey && !stats.dueLogged && canLog ? (
              <span className="inline-flex h-6 items-center rounded-full bg-[var(--status-progress-bg)] px-2.5 text-xs font-semibold text-[var(--status-progress-ink)]">Due</span>
            ) : null}
          </div>
          {canLog && stats.phase !== "upcoming" && logDate ? (
            <CheckInForm
              key={logDate}
              detail={detail}
              date={logDate}
              entry={entriesByKey.get(logDate) ?? null}
              onDateChange={setPicked}
              onSave={(values, note) => onLog(logDate, values, note)}
            />
          ) : (
            <p className="text-sm text-[var(--muted)]">{canLog && !logDate ? "Nothing to log right now." : cannotLogReason}</p>
          )}
        </div>

        <RecentLogs count={detail.entries.length}>
            <div className="text-footnote">
              {stats.dueKey && !stats.dueLogged && (
                <Row label={dayLabel(stats.dueKey, stats.today)} value="Not logged yet" tone="muted" />
              )}
              {detail.entries.slice(0, 8).map((e) => (
                <Row
                  key={e.id}
                  label={dayLabel(e.entryDate, stats.today)}
                  value={entrySummary(e, metrics)}
                  sub={e.userId !== detail.assigneeId ? `by ${memberName(members, e.userId)}` : (e.note ?? undefined)}
                  onClick={canLog ? () => setPicked(e.entryDate) : undefined}
                />
              ))}
              {detail.entries.length === 0 && !(stats.dueKey && !stats.dueLogged) && (
                <p className="py-2 text-[var(--muted)]">Nothing logged yet.</p>
              )}
            </div>
        </RecentLogs>
      </aside>
    </div>
  );
}

/** Recent logs in their own card, collapsed until you want them. */
function RecentLogs({ count, children }: { count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-[20px] bg-[var(--card)] shadow-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="pressable flex w-full items-center gap-2 rounded-[20px] px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        <span className="font-outfit text-subhead font-semibold text-[var(--fg)]">Recent logs</span>
        <span className="text-xs tabular-nums text-[var(--muted)]">{count}</span>
        <ChevronDown
          className={`ml-auto size-4 text-[var(--muted)] transition-transform duration-300 ease-[var(--motion-respond)] ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      <Collapse open={open} className="px-5 pb-4">
        {children}
      </Collapse>
    </div>
  );
}

function entrySummary(e: TrackerEntry, metrics: TrackerMetric[]) {
  return metrics
    .filter((m) => m.kind === "input" && e.values[m.id] != null)
    .map((m) => `${fullNumber(e.values[m.id])} ${m.name.toLowerCase()}`)
    .join(" · ");
}

function Row({
  label,
  value,
  sub,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "muted";
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-baseline justify-between gap-3 rounded-lg px-1 py-2 ${onClick ? "cursor-pointer hover:bg-[var(--fill)]" : ""}`}
    >
      <span className="shrink-0 text-[var(--fg)]">{label}</span>
      <span className="min-w-0 truncate text-right">
        <span className={tone === "muted" ? "text-[var(--muted)]" : "text-[var(--fg)]"}>{value}</span>
        {sub && <span className="ml-2 text-xs text-[var(--muted)]">{sub}</span>}
      </span>
    </div>
  );
}

function CheckInStrip({
  detail,
  onPick,
  selected,
}: {
  detail: TrackerDetailResponse;
  onPick?: (key: string) => void;
  selected: string | null;
}) {
  const reduced = useReducedMotion();
  // Show the most recent stretch up to today — long periods would otherwise be a wall of squares.
  const upTo = detail.stats.slots.filter((s) => s.state !== "upcoming");
  const shown = upTo.slice(-42);
  return (
    <div className="flex flex-wrap gap-[5px]" aria-label="Check-ins">
      {shown.map((s, i) => (
        <motion.button
          key={`${detail.id}-${s.key}`}
          type="button"
          title={`${dayLabel(s.key)} · ${s.state}`}
          disabled={!onPick}
          onClick={() => onPick?.(s.key)}
          initial={reduced ? false : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          // The one place with a little bounce: each square "lands".
          transition={{ type: "spring", bounce: 0.35, duration: 0.4, delay: reduced ? 0 : i * 0.012 }}
          className={`size-4 rounded-[5px] ${
            s.state === "logged"
              ? "bg-[var(--status-done)]"
              : s.state === "missed"
                ? "bg-[var(--danger)]"
                : "bg-[var(--status-progress)]"
          } ${selected === s.key ? "ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--card)]" : ""}`}
        />
      ))}
    </div>
  );
}

/**
 * The tracker's chart, on the same Apple principle as the dashboard's: a readout above (value so far,
 * or the scrubbed check-in), then a clean line with a soft wash — no grid, no axis, no captions. The
 * target pace is one quiet line; Daily/Weekly swaps the line for rounded bars, short days faded.
 */
function TrackerChart({
  detail,
  mode,
  onModeChange,
}: {
  detail: TrackerDetailResponse;
  mode: "cumulative" | "per";
  onModeChange: (m: "cumulative" | "per") => void;
}) {
  const reduced = useReducedMotion();
  const defaultId =
    (detail.metrics.find((m) => m.kind === "input" && m.target != null) ?? detail.metrics[0])?.id ?? "";
  const [metricId, setMetricId] = useState(defaultId);
  const [hover, setHover] = useState<number | null>(null);
  const metric = detail.metrics.find((m) => m.id === metricId) ?? detail.metrics.find((m) => m.id === defaultId);
  const slots = detail.stats.slots;

  const data = useMemo(() => {
    if (!metric) return null;
    const n = Math.max(1, slots.length);
    const valuesAt = new Map(detail.entries.map((e) => [e.entryDate, e.values]));
    const f = metric.kind === "formula" ? metric.formula : null;
    const slotValue = (vals: Record<string, number> | undefined): number | null => {
      if (!vals) return null;
      if (!f) return vals[metric.id] ?? null;
      const a = vals[f.a];
      const b = vals[f.b];
      return a == null || b == null ? null : applyTrackerFormula(f, a, b);
    };
    let runA = 0;
    let runB = 0;
    let run = 0;
    let lastIndex = -1;
    // One value per check-in slot; upcoming slots stay null so the axis spans the whole period.
    const cumulative: (number | null)[] = [];
    const per: (number | null)[] = [];
    slots.forEach((sl, i) => {
      if (sl.state === "upcoming") {
        cumulative.push(null);
        per.push(null);
        return;
      }
      lastIndex = i;
      const vals = valuesAt.get(sl.key);
      if (f) {
        runA += vals?.[f.a] ?? 0;
        runB += vals?.[f.b] ?? 0;
        const v = applyTrackerFormula(f, runA, runB);
        cumulative.push(v != null && Number.isFinite(v) ? v : (cumulative[i - 1] ?? 0));
      } else {
        run += vals?.[metric.id] ?? 0;
        cumulative.push(run);
      }
      per.push(slotValue(vals));
    });
    return { cumulative, per, n, lastIndex };
  }, [metric, detail.entries, slots]);

  if (!metric || !data) return null;

  const isFormula = metric.kind === "formula";
  const target = metric.target;
  const atMost = metric.direction === "at_most";
  const stat = detail.stats.metrics.find((x) => x.metricId === metric.id);
  const perTarget = target == null ? null : isFormula ? target : target / data.n;
  const meets = (v: number, goal: number) => (atMost ? v <= goal : v >= goal);
  const hasData = data.lastIndex >= 0;

  // Where the target says you should be at slot i: a rising pace line, or the flat target for a ratio.
  const goalAt = (i: number) => (target == null ? null : isFormula ? target : (target * (i + 1)) / data.n);
  const series = mode === "cumulative" ? data.cumulative : data.per;
  const guide =
    mode === "cumulative" ? (target == null ? null : data.cumulative.map((_, i) => goalAt(i))) : perTarget;

  const at = hover ?? data.lastIndex;
  const shownValue = !hasData
    ? null
    : hover == null && mode === "cumulative"
      ? (stat?.value ?? data.cumulative[at])
      : series[at];
  const goalNow = mode === "cumulative" ? (hasData ? goalAt(at) : null) : perTarget;
  const variance = goalNow == null || shownValue == null ? null : atMost ? goalNow - shownValue : shownValue - goalNow;
  const good = variance != null && variance >= 0;
  const varianceText =
    variance == null
      ? null
      : mode === "per" || isFormula
        ? `${metricValue(metric, Math.abs(variance))} ${good ? (atMost ? "under" : "over") : atMost ? "over" : "short"}`
        : `${metricValue(metric, Math.abs(variance))} ${good ? "ahead" : "behind"}`;

  const slotName = (i: number) => {
    const key = slots[i]?.key;
    if (!key) return "";
    return detail.checkIn === "weekly" ? `Week of ${dayLabel(key)}` : dayLabel(key, detail.stats.today);
  };
  const caption =
    hover != null
      ? slotName(hover)
      : mode === "cumulative"
        ? isFormula
          ? "Running so far"
          : "So far"
        : hasData
          ? slotName(data.lastIndex)
          : "No check-ins yet";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          size="sm"
          value={metric.id}
          onChange={(v) => {
            setMetricId(v);
            setHover(null);
          }}
          aria-label="Metric to chart"
          options={detail.metrics.map((m) => ({ value: m.id, label: m.name }))}
        />
        <Segmented
          size="sm"
          value={mode}
          onChange={(v) => {
            onModeChange(v);
            setHover(null);
          }}
          aria-label="Chart view"
          options={[
            { value: "cumulative", label: isFormula ? "Running" : "Cumulative" },
            { value: "per", label: detail.checkIn === "weekly" ? "Weekly" : "Daily" },
          ]}
        />
      </div>

      {/* Readout: follows the scrub, like the dashboard chart. */}
      <div className="mt-3 min-h-[58px]" aria-live="polite">
        <p className="text-xs font-semibold text-[var(--muted)]">{caption}</p>
        <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-outfit text-4xl font-semibold leading-none tracking-[-0.035em] tabular-nums">
            {shownValue == null ? "—" : metricValue(metric, shownValue)}
          </span>
          {goalNow != null ? (
            <span className="text-sm tabular-nums text-[var(--muted)]">
              of {atMost ? "≤ " : ""}
              {metricValue(metric, goalNow)}
            </span>
          ) : (
            <span className="text-sm text-[var(--muted)]">no target</span>
          )}
          {varianceText ? (
            <span
              className={
                "ml-1 inline-flex h-6 items-center rounded-full px-2 text-xs font-semibold tabular-nums " +
                (good
                  ? "bg-[var(--status-done-bg)] text-[var(--status-done-ink)]"
                  : "bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[var(--danger)]")
              }
            >
              {good ? "↑" : "↓"} {varianceText}
            </span>
          ) : null}
        </p>
      </div>

      <div className="relative mt-1 h-[180px]">
        {hasData ? (
          <SmoothLineChart
            key={`${detail.id}-${metric.id}-${mode}`}
            values={series}
            lastIndex={data.lastIndex}
            variant={mode === "cumulative" ? "line" : "bars"}
            guide={guide}
            muted={mode === "per" && perTarget != null ? data.per.map((v) => v != null && !meets(v, perTarget)) : undefined}
            color="var(--dept-1)"
            hover={hover}
            onHover={setHover}
            reduce={!!reduced}
            ariaLabel={`${metric.name} over time`}
            startLabel={slots[0] ? dayLabel(slots[0].key) : ""}
            endLabel={slots.length ? dayLabel(slots[slots.length - 1].key, detail.stats.today) : ""}
          />
        ) : (
          <p className="grid h-full place-items-center text-sm text-[var(--muted)]">Nothing logged yet</p>
        )}
      </div>
      {isFormula && metric.formula ? (
        <p className="mt-2 text-xs text-[var(--muted)]">{formulaText(metric, detail.metrics)}</p>
      ) : null}
    </div>
  );
}

function formulaText(m: TrackerMetric, all: TrackerMetric[]) {
  if (!m.formula) return "";
  const a = all.find((x) => x.id === m.formula!.a)?.name ?? "?";
  const b = all.find((x) => x.id === m.formula!.b)?.name ?? "?";
  const sym = { div: "÷", mul: "×", add: "+", sub: "−" }[m.formula.op];
  return `${a} ${sym} ${b}`;
}

function CheckInForm({
  detail,
  date,
  entry,
  onDateChange,
  onSave,
}: {
  detail: TrackerDetailResponse;
  date: string;
  entry: TrackerEntry | null;
  onDateChange: (d: string) => void;
  onSave: (values: Record<string, number>, note: string | null) => Promise<unknown>;
}) {
  const inputs = detail.metrics.filter((m) => m.kind === "input");
  const formulas = detail.metrics.filter((m) => m.kind === "formula");
  const [raw, setRaw] = useState<Record<string, string>>(() =>
    Object.fromEntries(inputs.map((m) => [m.id, entry?.values[m.id] != null ? fullNumber(entry.values[m.id], 4) : ""])),
  );
  const [note, setNote] = useState(entry?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = Object.fromEntries(
    Object.entries(raw)
      .map(([id, v]) => [id, v.trim() === "" ? NaN : Number(v.replace(/,/g, ""))] as const)
      .filter(([, v]) => Number.isFinite(v)),
  ) as Record<string, number>;

  const slotOptions = detail.stats.slots.filter((s) => s.state !== "upcoming").slice(-21).reverse();
  const share = (m: TrackerMetric) => {
    const s = detail.stats.metrics.find((x) => x.metricId === m.id);
    return s?.slice != null ? metricValue(m, s.slice) : null;
  };

  async function submit() {
    if (Object.keys(parsed).length === 0) {
      setError("Enter at least one number");
      return;
    }
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await onSave(parsed, note.trim() || null);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the log");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--muted)]">
            {detail.checkIn === "weekly" ? "Week of" : "Day"}
          </span>
          {/* The app's own dropdown, styled like the task page's pickers. */}
          <SelectPopover
            value={date}
            onChange={onDateChange}
            aria-label={detail.checkIn === "weekly" ? "Week to log" : "Day to log"}
            options={slotOptions.map((s) => ({
              value: s.key,
              label: `${dayLabel(s.key, detail.stats.today)}${s.state === "logged" ? " · logged" : s.state === "missed" ? " · missed" : ""}`,
            }))}
            triggerClassName="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-1.5 text-sm font-semibold text-[var(--fg)] transition-[background-color,transform] duration-150 hover:bg-[var(--surface-hover)] active:scale-[0.97]"
          />
        </div>
        {entry && <span className="text-xs text-[var(--muted)]">Editing a saved log</span>}
      </div>
      {inputs.map((m) => (
        <label key={m.id} className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] py-2.5 first-of-type:mt-2">
          <span className="text-sm text-[var(--muted)]">
            {m.name}
            {share(m) && <span className="ml-2 text-xs opacity-70">share {share(m)}</span>}
          </span>
          <input
            inputMode="decimal"
            value={raw[m.id] ?? ""}
            onChange={(e) => {
              setRaw((r) => ({ ...r, [m.id]: e.target.value }));
              setError(null);
              setSaved(false);
            }}
            placeholder="0"
            className="w-28 border-none bg-transparent p-0 text-right text-sm font-medium text-[var(--fg)] outline-none placeholder:text-[var(--muted)]"
          />
        </label>
      ))}
      {formulas.map((m) => {
        const v =
          m.formula && parsed[m.formula.a] != null && parsed[m.formula.b] != null
            ? applyTrackerFormula(m.formula, parsed[m.formula.a]!, parsed[m.formula.b]!)
            : null;
        return (
          <div key={m.id} className="flex items-center justify-between border-t border-[var(--border-subtle)] py-2.5 text-sm">
            <span className="text-[var(--muted)]">{m.name}</span>
            <span className="text-[var(--muted)]">{metricValue(m, v)}</span>
          </div>
        );
      })}
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note"
        maxLength={1000}
        className="w-full border-t border-[var(--border-subtle)] bg-transparent py-2.5 text-sm text-[var(--fg)] outline-none placeholder:text-[var(--muted)]"
      />
      <div className="flex items-center justify-end gap-3 pt-1">
        {error ? (
          <span className="mr-auto text-footnote text-[var(--danger)] dark:text-[var(--danger)]">{error}</span>
        ) : saved ? (
          <span className="mr-auto text-footnote text-[var(--success)] dark:text-[var(--success)]">Saved</span>
        ) : null}
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="rounded-lg bg-[var(--accent)] px-3.5 py-1.5 text-footnote font-medium text-[var(--bg)] transition-transform duration-100 active:scale-[0.97] disabled:opacity-60"
        >
          {saving ? "Saving…" : entry ? "Update log" : "Save log"}
        </button>
      </div>
    </div>
  );
}

