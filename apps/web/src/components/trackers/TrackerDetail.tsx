"use client";

import { useMemo, useState, type CSSProperties } from "react";
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
import { Segmented } from "./Segmented";
import { Avatar } from "@/components/ui/Avatar";
import { SelectPopover } from "@/components/ui/SelectPopover";
import {
  PACE_DOT,
  PACE_LABEL,
  PACE_TEXT,
  compactNumber,
  dayLabel,
  fullNumber,
  metricValue,
  periodLabel,
} from "./tracker-format";

const SPRING = { type: "spring", bounce: 0, duration: 0.5 } as const;
const CARD_MAIN = "rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4";
const CARD_SIDE = "rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-5";
const CARD_TITLE = "text-xs font-semibold uppercase tracking-wide text-[var(--muted)]";
const SECTION_LABEL = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]";

function memberName(members: MemberRow[], id: string | null) {
  if (!id) return "Unassigned";
  const m = members.find((x) => x.userId === id);
  return (m?.name ?? "").trim() || (m?.email ?? "").trim() || "Someone";
}

/** One line under each metric telling the assignee what to do next. */
function metricNote(m: TrackerMetric, s: TrackerMetricStats, metrics: TrackerMetric[], unitWord: string): string {
  if (m.kind === "formula" && m.formula) {
    const a = metrics.find((x) => x.id === m.formula!.a)?.name ?? "?";
    const b = metrics.find((x) => x.id === m.formula!.b)?.name ?? "?";
    const sym = { div: "÷", mul: "×", add: "+", sub: "−" }[m.formula.op];
    return `${a} ${sym} ${b}${m.formula.percent ? " × 100" : ""}`;
  }
  if (s.target == null) return "No target";
  if (s.pace === "met") return "Target met";
  if (s.pace === "missed") return m.direction === "at_most" ? "Over the limit" : "Target missed";
  const d = Math.abs(s.delta ?? 0);
  const fmt = (v: number) => metricValue(m, v);
  if (s.pace === "behind") {
    const need = s.neededPerUnit != null ? ` · need ${fmt(s.neededPerUnit)} a ${unitWord}` : "";
    return `${fmt(d)} behind${need}`;
  }
  if (s.pace === "ahead") return `${fmt(d)} ahead of pace`;
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
  const reduced = useReducedMotion();
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

  return (
    <div className="flex min-w-0 flex-col gap-5 xl:flex-row xl:items-start">
      {/* ───────────── Main column ───────────── */}
      <div className="min-w-0 flex-1 space-y-4">
        <div className={`${CARD_MAIN} space-y-4`}>
          <div className="flex items-center justify-between gap-3">
            <h3 className={CARD_TITLE}>Tracker</h3>
            {detail.canManage && (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1 text-xs font-medium text-[var(--muted)] transition-[color,transform] duration-150 hover:text-[var(--fg)] active:scale-[0.97]"
              >
                Edit tracker
              </button>
            )}
          </div>
          <h1 className="border-b border-[var(--border-subtle)] pb-1.5 text-2xl font-semibold leading-snug text-[var(--fg)]">
            {detail.name}
          </h1>

          {/* The details, merged into the tracker card as one row. */}
          <div className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4">
            <div className="min-w-0">
              <span className={SECTION_LABEL}>Status</span>
              <span
                className={`inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2.5 py-1 text-sm font-semibold ${
                  missedFirst ? "text-amber-600 dark:text-amber-400" : PACE_TEXT[stats.pace]
                }`}
              >
                <span className={`size-2 rounded-full ${missedFirst ? "bg-amber-500" : PACE_DOT[stats.pace]}`} />
                {missedFirst ? `${stats.missedCount} missed` : PACE_LABEL[stats.pace]}
              </span>
            </div>
            <div className="min-w-0">
              <span className={SECTION_LABEL}>Assigned to</span>
              <span className="inline-flex max-w-full items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] py-1 pl-1.5 pr-2.5 text-sm font-semibold text-[var(--fg)]">
                {assignee ? (
                  <Avatar
                    name={assignee.name}
                    email={assignee.email}
                    image={assignee.image}
                    size="size-5"
                    className="bg-[var(--accent-muted)] text-[9px] font-semibold text-[var(--fg)]"
                  />
                ) : (
                  <span className="size-5 shrink-0 rounded-full border border-dashed border-[var(--border)]" />
                )}
                <span className={`truncate ${detail.assigneeId ? "" : "text-[var(--muted)]"}`}>
                  {memberName(members, detail.assigneeId)}
                </span>
              </span>
            </div>
            <div className="min-w-0">
              <span className={SECTION_LABEL}>Period</span>
              <p className="truncate text-sm font-semibold text-[var(--fg)]">{periodLabel(detail.periodStart, detail.periodEnd)}</p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">{phaseLabel}</p>
            </div>
            <div className="min-w-0">
              <span className={SECTION_LABEL}>Rhythm</span>
              <p className="text-sm font-semibold text-[var(--fg)]">{detail.checkIn === "weekly" ? "Logged weekly" : "Logged daily"}</p>
              <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                Split {detail.split === "week" ? "per week" : "per working day"}
                {detail.reminderTime ? ` · reminder ${detail.reminderTime}` : ""}
              </p>
            </div>
          </div>
        </div>

        <div className={`${CARD_MAIN} space-y-4`}>
          <h3 className={CARD_TITLE}>Progress</h3>
          <div
            className="grid grid-cols-1 gap-y-4 sm:grid-cols-[repeat(var(--cols),minmax(0,1fr))]"
            style={{ "--cols": Math.min(4, metrics.length) } as CSSProperties}
          >
            {metrics.map((m, i) => {
              const s = stats.metrics[i]!;
              const pct = s.target ? Math.min(1, Math.max(0, (s.value ?? 0) / s.target)) : 0;
              return (
                <div key={m.id} className={`min-w-0 sm:px-5 ${i === 0 ? "sm:pl-0" : "sm:border-l sm:border-[var(--border-subtle)]"}`}>
                  <p className={SECTION_LABEL}>
                    {m.name}
                    {m.kind === "formula" && <span className="font-normal normal-case tracking-normal opacity-70"> · calculated</span>}
                  </p>
                  <p className="flex items-baseline gap-1.5">
                    <SpringNumber
                      value={s.value}
                      format={(v) => metricValue(m, v)}
                      className="text-[28px] font-semibold leading-none tracking-[-0.02em] text-[var(--fg)]"
                    />
                    {s.target != null && (
                      <span className="text-[13px] text-[var(--muted)]">
                        / {m.direction === "at_most" ? "≤ " : m.kind === "formula" ? "≥ " : ""}
                        {metricValue(m, s.target)}
                      </span>
                    )}
                  </p>
                  {m.kind === "input" && s.target != null ? (
                    <div className="relative mt-3 h-[3px] rounded-full bg-[var(--border)]">
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full bg-[var(--fg)]"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct * 100}%` }}
                        transition={reduced ? { duration: 0 } : SPRING}
                      />
                      <div
                        className={`absolute -top-1 h-[11px] w-[1.5px] rounded-full ${s.pace === "behind" || s.pace === "missed" ? "bg-red-500" : "bg-emerald-500"}`}
                        style={{ left: `${stats.progress * 100}%` }}
                        title="Where you should be by now"
                      />
                    </div>
                  ) : (
                    <div className="h-[15px]" />
                  )}
                  <p className={`mt-2 text-xs ${m.kind === "formula" && s.pace === "none" ? "text-[var(--muted)]" : PACE_TEXT[s.pace]}`}>
                    {metricNote(m, s, metrics, unitWord)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className={CARD_MAIN}>
          <TrackerChart detail={detail} mode={chartMode} onModeChange={setChartMode} />
        </div>

        <div className={CARD_MAIN}>
          <div className="flex items-center justify-between">
            <h3 className={CARD_TITLE}>Logs</h3>
            <span className="text-xs text-[var(--muted)]">{stats.missedCount ? `${stats.missedCount} missed` : "No misses"}</span>
          </div>
          <CheckInStrip detail={detail} onPick={canLog ? (key) => setPicked(key) : undefined} selected={canLog ? logDate : null} />
          <div className="text-[13px]">
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
              <p className="border-t border-[var(--border-subtle)] py-2 text-[var(--muted)]">Nothing logged yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* ───────────── Right: Log progress, always open and in view while scrolling ───────────── */}
      <aside className="w-full xl:sticky xl:top-4 xl:w-80 xl:shrink-0">
        <div className={`${CARD_SIDE} space-y-3`}>
          <h3 className={CARD_TITLE}>Log progress</h3>
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
      </aside>
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
      className={`flex items-baseline justify-between gap-3 border-t border-[var(--border-subtle)] py-2 ${onClick ? "cursor-pointer hover:text-[var(--fg)]" : ""}`}
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
    <div className="my-2.5 flex flex-wrap gap-1" aria-label="Recent logs">
      {shown.map((s, i) => (
        <motion.button
          key={`${detail.id}-${s.key}`}
          type="button"
          title={`${dayLabel(s.key)} · ${s.state}`}
          disabled={!onPick}
          onClick={() => onPick?.(s.key)}
          initial={reduced ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          // The one place with a little bounce: each square "lands".
          transition={{ type: "spring", bounce: 0.35, duration: 0.4, delay: reduced ? 0 : i * 0.012 }}
          className={`size-3 rounded-[3px] ${
            s.state === "logged"
              ? "bg-[var(--fg)]"
              : s.state === "missed"
                ? "border border-dashed border-red-500"
                : "border border-[var(--muted)]"
          } ${selected === s.key ? "ring-2 ring-[var(--fg)] ring-offset-2 ring-offset-[var(--bg)]" : ""}`}
        />
      ))}
    </div>
  );
}

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
  const metric = detail.metrics.find((m) => m.id === metricId) ?? detail.metrics.find((m) => m.id === defaultId);
  const slots = detail.stats.slots;
  const W = 640;
  const H = 130;
  const PAD = 14;

  const data = useMemo(() => {
    if (!metric) return null;
    const n = Math.max(1, slots.length);
    const valuesAt = new Map(detail.entries.map((e) => [e.entryDate, e.values]));
    const f = metric.kind === "formula" ? metric.formula : null;
    // Per slot: the metric's own value (input), or the formula applied to that slot's inputs.
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
    const cumulative: { x: number; v: number }[] = f ? [] : [{ x: 0, v: 0 }];
    const per: { x: number; v: number | null }[] = [];
    slots.forEach((sl, i) => {
      if (sl.state === "upcoming") return;
      const vals = valuesAt.get(sl.key);
      if (f) {
        runA += vals?.[f.a] ?? 0;
        runB += vals?.[f.b] ?? 0;
        const v = applyTrackerFormula(f, runA, runB);
        if (v != null && Number.isFinite(v)) cumulative.push({ x: (i + 1) / n, v });
      } else {
        run += vals?.[metric.id] ?? 0;
        cumulative.push({ x: (i + 1) / n, v: run });
      }
      per.push({ x: (i + 0.5) / n, v: slotValue(vals) });
    });
    return { cumulative, per, n };
  }, [metric, detail.entries, slots]);

  if (!metric || !data) return null;

  const isFormula = metric.kind === "formula";
  const target = metric.target;
  const atMost = metric.direction === "at_most";
  const stat = detail.stats.metrics.find((x) => x.metricId === metric.id);
  // A logged metric is paced against a line rising to the target; a calculated one against the target itself.
  const perTarget = target == null ? null : isFormula ? target : target / data.n;
  const meets = (v: number, goal: number) => (atMost ? v <= goal : v >= goal);

  const cumValues = data.cumulative.map((pt) => pt.v);
  const maxC = Math.max(target ?? 0, ...cumValues, 1) * 1.08;
  const perValues = data.per.map((pt) => pt.v ?? 0);
  const maxP = Math.max(perTarget ?? 0, ...perValues, 1) * 1.15;
  const x = (fr: number) => fr * W;
  const yC = (v: number) => H - PAD - (v / maxC) * (H - PAD * 2);
  const yP = (v: number) => H - (v / maxP) * (H - PAD);
  const path = data.cumulative.map((pt, i) => `${i ? "L" : "M"}${x(pt.x).toFixed(1)},${yC(pt.v).toFixed(1)}`).join(" ");
  const last = data.cumulative[data.cumulative.length - 1];
  const barW = Math.max(2, Math.min(18, (W / data.n) * 0.6));

  // Variance at the latest point: vs the pace line for logged metrics, vs the target for calculated ones.
  const goalNow =
    target == null || !last ? null : isFormula ? target : target * last.x;
  const variance = goalNow == null || !last ? null : atMost ? goalNow - last.v : last.v - goalNow;
  const good = variance != null && variance >= 0;
  const varianceText =
    variance == null
      ? null
      : isFormula
        ? `${metricValue(metric, Math.abs(variance))} ${good ? (atMost ? "under" : "above") : atMost ? "over" : "below"} target`
        : `${metricValue(metric, Math.abs(variance))} ${good ? "ahead of" : "behind"} pace`;
  const tone = good ? "var(--chart-good, #10b981)" : "var(--chart-bad, #ef4444)";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Segmented
            value={metric.id}
            onChange={setMetricId}
            aria-label="Metric to chart"
            options={detail.metrics.map((m) => ({ value: m.id, label: m.name }))}
          />
        </div>
        <Segmented
          value={mode}
          onChange={onModeChange}
          aria-label="Chart view"
          options={[
            { value: "cumulative", label: isFormula ? "Running" : "Cumulative" },
            { value: "per", label: detail.checkIn === "weekly" ? "Weekly" : "Daily" },
          ]}
        />
      </div>

      <p className="mt-2 text-xs text-[var(--muted)]">
        <span className="font-semibold text-[var(--fg)]">{metricValue(metric, stat?.value ?? last?.v ?? null)}</span>
        {target != null ? ` of ${atMost ? "≤ " : isFormula ? "≥ " : ""}${metricValue(metric, target)}` : " · no target"}
        {mode === "cumulative" && varianceText ? (
          <span className={good ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}> · {varianceText}</span>
        ) : null}
        {isFormula && metric.formula ? <span> · {formulaText(metric, detail.metrics)}</span> : null}
      </p>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-[130px] w-full overflow-visible" role="img" aria-label={`${metric.name} over time`}>
        <line x1={0} y1={H - (mode === "cumulative" ? PAD : 0)} x2={W} y2={H - (mode === "cumulative" ? PAD : 0)} stroke="var(--border)" strokeWidth={0.5} />
        {mode === "cumulative" ? (
          <g key={`c-${detail.id}-${metric.id}`}>
            {target != null && (
              <>
                <line
                  x1={0}
                  y1={isFormula ? yC(target) : yC(0)}
                  x2={W}
                  y2={yC(target)}
                  stroke="var(--muted)"
                  strokeWidth={1}
                  strokeDasharray="3 4"
                  opacity={0.7}
                />
                <text x={W} y={yC(target) - 6} textAnchor="end" className="fill-[var(--muted)] text-[11px]">
                  target {compactNumber(target)}
                </text>
              </>
            )}
            {path && (
              <motion.path
                d={path}
                fill="none"
                stroke="var(--fg)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={reduced ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: reduced ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
              />
            )}
            {last && goalNow != null && (
              // The variance itself: a bracket from where you are to where the target says you should be.
              <line x1={x(last.x)} y1={yC(last.v)} x2={x(last.x)} y2={yC(goalNow)} stroke={tone} strokeWidth={1.5} strokeDasharray="2 2" />
            )}
            {last && <circle cx={x(last.x)} cy={yC(last.v)} r={3.5} fill={goalNow == null ? "var(--fg)" : tone} />}
            {!last && (
              <text x={W / 2} y={H / 2} textAnchor="middle" className="fill-[var(--muted)] text-[12px]">
                Nothing logged yet
              </text>
            )}
          </g>
        ) : (
          <g key={`p-${detail.id}-${metric.id}`}>
            {perTarget != null && (
              <>
                <line x1={0} y1={yP(perTarget)} x2={W} y2={yP(perTarget)} stroke="var(--muted)" strokeDasharray="3 4" opacity={0.7} />
                <text x={W} y={yP(perTarget) - 6} textAnchor="end" className="fill-[var(--muted)] text-[11px]">
                  {isFormula ? "target" : detail.checkIn === "weekly" ? "weekly share" : "daily share"} {compactNumber(perTarget)}
                </text>
              </>
            )}
            {data.per.map((pt, i) => {
              if (pt.v == null) return null;
              const h = Math.max(pt.v > 0 ? 2 : 0, H - yP(pt.v));
              // Bars that met their share (or the target) are solid; the ones that fell short are faded.
              const ok = perTarget == null || meets(pt.v, perTarget);
              return (
                <motion.rect
                  key={i}
                  x={x(pt.x) - barW / 2}
                  width={barW}
                  rx={2}
                  fill="var(--fg)"
                  opacity={ok ? 1 : 0.35}
                  initial={reduced ? false : { height: 0, y: H }}
                  animate={{ height: h, y: H - h }}
                  transition={reduced ? { duration: 0 } : { type: "spring", bounce: 0, duration: 0.45, delay: i * 0.01 }}
                />
              );
            })}
          </g>
        )}
      </svg>
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
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
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
          <span className="mr-auto text-[13px] text-red-600 dark:text-red-400">{error}</span>
        ) : saved ? (
          <span className="mr-auto text-[13px] text-emerald-600 dark:text-emerald-400">Saved</span>
        ) : null}
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="rounded-lg bg-[var(--accent)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--bg)] transition-transform duration-100 active:scale-[0.97] disabled:opacity-60"
        >
          {saving ? "Saving…" : entry ? "Update log" : "Save log"}
        </button>
      </div>
    </div>
  );
}

