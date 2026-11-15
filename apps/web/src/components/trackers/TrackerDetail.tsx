"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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

function memberName(members: MemberRow[], id: string) {
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
  const [formDate, setFormDate] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<"cumulative" | "per">("cumulative");

  const canLog = !detail.archivedAt && (detail.canManage || detail.assigneeId === currentUserId);
  const unitWord = detail.split === "week" ? "week" : "day";
  const entriesByKey = useMemo(() => new Map(detail.entries.map((e) => [e.entryDate, e])), [detail.entries]);
  const firstOpen = stats.dueKey && !stats.dueLogged ? stats.dueKey : ([...stats.slots].reverse().find((s) => s.state === "missed")?.key ?? stats.dueKey);

  const meta = [
    memberName(members, detail.assigneeId),
    periodLabel(detail.periodStart, detail.periodEnd),
    stats.phase === "active"
      ? `${unitWord} ${Math.min(stats.totalUnits, stats.elapsedUnits + 1)} of ${stats.totalUnits}`
      : stats.phase === "ended"
        ? "Ended"
        : "Not started",
    detail.checkIn === "weekly" ? "logged weekly" : "logged daily",
  ].join(" · ");

  const assignee = members.find((x) => x.userId === detail.assigneeId);
  const phaseLabel =
    stats.phase === "active"
      ? `${unitWord === "week" ? "Week" : "Day"} ${Math.min(stats.totalUnits, stats.elapsedUnits + 1)} of ${stats.totalUnits}`
      : stats.phase === "ended"
        ? "Ended"
        : "Not started";

  return (
    <div className="flex min-w-0 flex-col gap-5 xl:flex-row xl:items-start">
      {/* ───────────── Main column: cards, as on the task page ───────────── */}
      <div className="min-w-0 flex-1 space-y-4">
        <div className={`${CARD_MAIN} space-y-3`}>
          <h3 className={CARD_TITLE}>Tracker</h3>
          <div>
            <h1 className="border-b border-[var(--border-subtle)] pb-1.5 text-2xl font-semibold leading-snug text-[var(--fg)]">
              {detail.name}
            </h1>
            <p className="mt-1.5 text-xs text-[var(--muted)]">{meta}</p>
          </div>
          <AnimatePresence initial={false}>
            {formDate && (
              <motion.div
                key="form"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={reduced ? { duration: 0 } : { type: "spring", bounce: 0, duration: 0.35 }}
                className="overflow-hidden"
              >
                <CheckInForm
                  key={formDate}
                  detail={detail}
                  date={formDate}
                  entry={entriesByKey.get(formDate) ?? null}
                  onDateChange={setFormDate}
                  onSave={async (values, note) => {
                    // The log is applied optimistically, so close straight away; a failure is
                    // reported by the page and the numbers roll back.
                    setFormDate(null);
                    void onLog(formDate, values, note).catch(() => undefined);
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
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
          <CheckInStrip detail={detail} onPick={canLog ? (key) => setFormDate(key) : undefined} selected={formDate} />
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
                onClick={canLog ? () => setFormDate(e.entryDate) : undefined}
              />
            ))}
            {detail.entries.length === 0 && !(stats.dueKey && !stats.dueLogged) && (
              <p className="border-t border-[var(--border-subtle)] py-2 text-[var(--muted)]">Nothing logged yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* ───────────── Sidebar: details card + actions, as on the task page ───────────── */}
      <div className="w-full space-y-4 xl:w-72 xl:shrink-0">
        <div className={`${CARD_SIDE} space-y-4`}>
          <div>
            <span className={SECTION_LABEL}>Status</span>
            <span
              className={`inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-1.5 text-sm font-semibold ${
                stats.missedCount > 0 && stats.pace !== "behind" ? "text-amber-600 dark:text-amber-400" : PACE_TEXT[stats.pace]
              }`}
            >
              <span
                className={`size-2 rounded-full ${stats.missedCount > 0 && stats.pace !== "behind" ? "bg-amber-500" : PACE_DOT[stats.pace]}`}
              />
              {stats.missedCount > 0 && stats.pace !== "behind" ? `${stats.missedCount} missed` : PACE_LABEL[stats.pace]}
            </span>
          </div>
          <div>
            <span className={SECTION_LABEL}>Assigned to</span>
            <span className="inline-flex max-w-full items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] py-1 pl-1.5 pr-3 text-sm font-semibold text-[var(--fg)]">
              <Avatar
                name={assignee?.name}
                email={assignee?.email}
                image={assignee?.image}
                size="size-5"
                className="bg-[var(--accent-muted)] text-[9px] font-semibold text-[var(--fg)]"
              />
              <span className="truncate">{memberName(members, detail.assigneeId)}</span>
            </span>
          </div>
          <div>
            <span className={SECTION_LABEL}>Period</span>
            <p className="text-sm font-semibold text-[var(--fg)]">{periodLabel(detail.periodStart, detail.periodEnd)}</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">{phaseLabel}</p>
          </div>
          <div>
            <span className={SECTION_LABEL}>Rhythm</span>
            <p className="text-sm font-semibold text-[var(--fg)]">
              {detail.checkIn === "weekly" ? "Logged weekly" : "Logged daily"}
            </p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Target split {detail.split === "week" ? "per week" : "per working day"}
              {detail.reminderTime ? ` · reminder ${detail.reminderTime}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {canLog && stats.phase !== "upcoming" && (
            <button
              type="button"
              onClick={() => setFormDate((d) => (d ? null : (firstOpen ?? stats.today)))}
              className="btn-primary w-full rounded-lg px-3 py-1.5 text-sm font-medium transition-transform duration-150 active:scale-[0.97]"
            >
              {formDate ? "Close" : "Log progress"}
            </button>
          )}
          {detail.canManage && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex w-full items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--muted)] transition-[color,transform] duration-150 hover:text-[var(--fg)] active:scale-[0.97]"
            >
              Edit tracker
            </button>
          )}
        </div>
      </div>
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
  const metric =
    detail.metrics.find((m) => m.kind === "input" && m.target != null) ?? detail.metrics.find((m) => m.kind === "input");
  const slots = detail.stats.slots;
  const W = 640;
  const H = 120;
  const PAD = 12;

  const data = useMemo(() => {
    if (!metric) return null;
    const byKey = new Map(detail.entries.map((e) => [e.entryDate, e.values[metric.id] ?? 0]));
    const n = Math.max(1, slots.length);
    let run = 0;
    const cumulative: { x: number; v: number }[] = [{ x: 0, v: 0 }];
    const per: { x: number; v: number }[] = [];
    slots.forEach((s, i) => {
      if (s.state === "upcoming") return;
      const v = byKey.get(s.key) ?? 0;
      run += v;
      cumulative.push({ x: (i + 1) / n, v: run });
      per.push({ x: (i + 0.5) / n, v });
    });
    return { cumulative, per, n, byKey };
  }, [metric, detail.entries, slots]);

  if (!metric || !data) return null;
  const target = metric.target;
  const perSlice = target != null ? target / data.n : null;
  const maxC = Math.max(target ?? 0, ...data.cumulative.map((p) => p.v), 1);
  const maxP = Math.max(perSlice ?? 0, ...data.per.map((p) => p.v), 1) * 1.15;
  const x = (f: number) => f * W;
  const yC = (v: number) => H - PAD - (v / maxC) * (H - PAD * 2);
  const yP = (v: number) => H - (v / maxP) * (H - PAD);
  const path = data.cumulative.map((p, i) => `${i ? "L" : "M"}${x(p.x).toFixed(1)},${yC(p.v).toFixed(1)}`).join(" ");
  const last = data.cumulative[data.cumulative.length - 1]!;
  const barW = Math.max(2, Math.min(18, (W / data.n) * 0.6));

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          {metric.name} {target != null ? "vs target" : ""}
        </h3>
        <Segmented
          value={mode}
          onChange={onModeChange}
          aria-label="Chart view"
          options={[
            { value: "cumulative", label: "Cumulative" },
            { value: "per", label: detail.checkIn === "weekly" ? "Weekly" : "Daily" },
          ]}
        />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-[120px] w-full overflow-visible" role="img" aria-label={`${metric.name} over time`}>
        <line x1={0} y1={H - (mode === "cumulative" ? PAD : 0)} x2={W} y2={H - (mode === "cumulative" ? PAD : 0)} stroke="var(--border)" strokeWidth={0.5} />
        {mode === "cumulative" ? (
          <g key={`c-${detail.id}`}>
            {target != null && (
              <>
                <line x1={0} y1={yC(0)} x2={W} y2={yC(target)} stroke="var(--muted)" strokeWidth={1} strokeDasharray="3 4" opacity={0.7} />
                <text x={W} y={yC(target) - 6} textAnchor="end" className="fill-[var(--muted)] text-[11px]">
                  target {compactNumber(target)}
                </text>
              </>
            )}
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
            <circle cx={x(last.x)} cy={yC(last.v)} r={3.5} fill="var(--fg)" />
          </g>
        ) : (
          <g key={`p-${detail.id}`}>
            {perSlice != null && (
              <>
                <line x1={0} y1={yP(perSlice)} x2={W} y2={yP(perSlice)} stroke="var(--muted)" strokeDasharray="3 4" opacity={0.7} />
                <text x={W} y={yP(perSlice) - 6} textAnchor="end" className="fill-[var(--muted)] text-[11px]">
                  {detail.checkIn === "weekly" ? "weekly" : "daily"} share {compactNumber(perSlice)}
                </text>
              </>
            )}
            {data.per.map((p, i) => {
              const h = Math.max(p.v > 0 ? 2 : 0, H - yP(p.v));
              return (
                <motion.rect
                  key={i}
                  x={x(p.x) - barW / 2}
                  width={barW}
                  rx={2}
                  fill="var(--fg)"
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
  onSave: (values: Record<string, number>, note: string | null) => Promise<void>;
}) {
  const inputs = detail.metrics.filter((m) => m.kind === "input");
  const formulas = detail.metrics.filter((m) => m.kind === "formula");
  const [raw, setRaw] = useState<Record<string, string>>(() =>
    Object.fromEntries(inputs.map((m) => [m.id, entry?.values[m.id] != null ? fullNumber(entry.values[m.id], 4) : ""])),
  );
  const [note, setNote] = useState(entry?.note ?? "");
  const [saving, setSaving] = useState(false);
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
    setError(null);
    try {
      await onSave(parsed, note.trim() || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the log");
      setSaving(false);
    }
  }

  return (
    <div className="border-t border-[var(--border-subtle)] pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
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
            }}
            placeholder="0"
            className="w-36 border-none bg-transparent p-0 text-right text-sm font-medium text-[var(--fg)] outline-none placeholder:text-[var(--muted)]"
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
        {error && <span className="mr-auto text-[13px] text-red-600 dark:text-red-400">{error}</span>}
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

