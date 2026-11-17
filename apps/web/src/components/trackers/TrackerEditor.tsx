"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faCalculator,
  faCalendar,
  faChevronDown,
  faClock,
  faDivide,
  faMinus,
  faPlus,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import {
  applyTrackerFormula,
  trackerSlotKeys,
  type CreateTrackerInput,
  type TrackerFormula,
  type TrackerMetricUnit,
} from "@work-ledger/contracts";
import type { TrackerDetailResponse } from "@/hooks/useTrackers";
import type { MemberRow } from "@/lib/ledger-types";
import { SelectPopover, type SelectOption } from "@/components/ui/SelectPopover";
import { Toggle } from "@/components/ui/Toggle";
import { ConfirmDialog, type ConfirmDialogOptions } from "@/components/ui/ConfirmDialog";
import { TaskFormSyncIndicator } from "@/components/tasks/TaskFormSyncIndicator";
import type { TaskSyncStatus } from "@/hooks/useTaskAutoSync";
import { PersonSearchField } from "./PersonSearchField";
import { Segmented } from "./Segmented";
import { compactNumber } from "./tracker-format";
import { TRACKER_TEMPLATES, templateById, type TrackerTemplate } from "./tracker-templates";

type MetricDraft = {
  id: string;
  name: string;
  kind: "input" | "formula";
  unit: TrackerMetricUnit;
  currency: string;
  target: string;
  direction: "at_least" | "at_most";
  formula: TrackerFormula | null;
};

const UNIT_OPTIONS: SelectOption<TrackerMetricUnit>[] = [
  { value: "count", label: "Count" },
  { value: "number", label: "Number" },
  { value: "currency", label: "Money" },
  { value: "percent", label: "Percent" },
];
const OP_ICON = { div: faDivide, mul: faXmark, add: faPlus, sub: faMinus } as const;
const OP_OPTIONS: SelectOption<TrackerFormula["op"]>[] = [
  { value: "div", label: "Divided by" },
  { value: "mul", label: "Times" },
  { value: "add", label: "Plus" },
  { value: "sub", label: "Minus" },
];
const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SPRING = { type: "spring", bounce: 0, duration: 0.3 } as const;

/* The task page's visual language, so both editors read as one app. */
const SECTION_LABEL = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]";
const CARD_MAIN = "rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4";
const CARD_SIDE = "rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-5";
const CHIP =
  "inline-flex h-8 items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 text-sm font-semibold text-[var(--fg)] transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--surface-hover)] active:scale-[0.97]";
const GHOST_BTN =
  "inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-sm font-medium transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97]";
const FIELD =
  "h-8 w-full rounded-lg border border-transparent bg-transparent px-2.5 text-sm text-[var(--fg)] outline-none transition-[background-color,border-color] duration-150 placeholder:font-normal placeholder:text-[var(--muted)] hover:border-[var(--border-subtle)] focus:border-[var(--border-subtle)] focus:bg-[var(--surface-elevated)]";
/** Borderless and small, for pickers inside a line of text (the formula under a calculated metric). */
const INLINE =
  "!h-6 !border-transparent !bg-transparent !px-1.5 !text-xs !text-[var(--fg)] hover:!bg-[var(--surface-hover)]";
const GRID = "sm:grid-cols-[minmax(0,24rem)_8.5rem_12rem_2rem]";

const uuid = () => crypto.randomUUID();
const num = (s: string) => {
  const v = Number(s.replace(/,/g, "").trim());
  return s.trim() !== "" && Number.isFinite(v) ? v : null;
};
const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const quarterOf = (today: string) => Math.floor((Number(today.slice(5, 7)) - 1) / 3) + 1;

type Preset = "month" | "quarter" | "year";
function presetRange(p: Preset, today: string): [string, string] {
  const [y, m] = today.split("-").map(Number) as [number, number];
  if (p === "month") return [`${y}-${pad(m)}-01`, `${y}-${pad(m)}-${lastDay(y, m)}`];
  if (p === "year") return [`${y}-01-01`, `${y}-12-31`];
  const q = Math.floor((m - 1) / 3);
  return [`${y}-${pad(q * 3 + 1)}-01`, `${y}-${pad(q * 3 + 3)}-${lastDay(y, q * 3 + 3)}`];
}
function presetOf(start: string, end: string, today: string): Preset | null {
  for (const p of ["month", "quarter", "year"] as const) {
    const [s, e] = presetRange(p, today);
    if (s === start && e === end) return p;
  }
  return null;
}
const shortDate = (key: string) => {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]} ${y}`;
};
const timeLabel = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? "am" : "pm"}`;
};
/** 600000 → 600,000 while typing; keeps decimals. */
function groupDigits(raw: string) {
  const clean = raw.replace(/[^\d.]/g, "");
  const [int, ...rest] = clean.split(".");
  const grouped = (int ?? "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return rest.length ? `${grouped}.${rest.join("")}` : grouped;
}

/** A calculated metric's target follows from its inputs' targets (600,000 revenue ÷ 60 orders → 10,000). */
function formulaTarget(m: MetricDraft, all: MetricDraft[]): number | null {
  if (m.kind !== "formula" || !m.formula) return null;
  const a = num(all.find((x) => x.id === m.formula!.a)?.target ?? "");
  const b = num(all.find((x) => x.id === m.formula!.b)?.target ?? "");
  return a != null && b != null ? applyTrackerFormula(m.formula, a, b) : null;
}

function fromTemplate(t: TrackerTemplate): MetricDraft[] {
  const ids = new Map(t.metrics.map((m) => [m.key, uuid()]));
  return t.metrics.map((m) => ({
    id: ids.get(m.key)!,
    name: m.name,
    kind: m.kind,
    unit: m.unit,
    currency: m.unit === "currency" ? "PKR" : "",
    target: m.target != null ? groupDigits(String(m.target)) : "",
    direction: m.direction ?? "at_least",
    formula: m.formula ? { op: m.formula.op, a: ids.get(m.formula.a)!, b: ids.get(m.formula.b)!, percent: m.formula.percent } : null,
  }));
}

function Chevron() {
  return <FontAwesomeIcon icon={faChevronDown} className="size-2.5 text-[var(--muted)]" />;
}

function Pick<T extends string>({
  value,
  onChange,
  options,
  label,
  children,
  className = "",
}: {
  value: T;
  onChange: (v: T) => void;
  options: SelectOption<T>[];
  label: string;
  children?: ReactNode;
  className?: string;
}) {
  const current = options.find((o) => o.value === value)?.label ?? "";
  return (
    <SelectPopover
      value={value}
      onChange={onChange}
      options={options}
      aria-label={label}
      showChevron={false}
      triggerClassName={`${CHIP} ${className}`}
      triggerContent={
        <>
          {children ?? <span className="truncate">{current}</span>}
          <Chevron />
        </>
      }
    />
  );
}

/** A chip that opens the native date/time picker without exposing the raw input's styling. */
function PickerChip({
  type,
  value,
  onChange,
  label,
  icon,
  ariaLabel,
}: {
  type: "date" | "time";
  value: string;
  onChange: (v: string) => void;
  label: string;
  icon: typeof faCalendar;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={ariaLabel}
        className={CHIP}
        onClick={() => {
          const el = ref.current;
          if (el && typeof el.showPicker === "function") el.showPicker();
          else el?.focus();
        }}
      >
        <FontAwesomeIcon icon={icon} className="size-3 text-[var(--muted)]" />
        <span className="tabular-nums">{label}</span>
      </button>
      <input
        ref={ref}
        type={type}
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0"
      />
    </span>
  );
}

export function TrackerEditor({
  editing,
  members,
  today,
  initialTemplate,
  onCreate,
  onUpdate,
  onArchive,
  onDelete,
  onClose,
}: {
  editing: TrackerDetailResponse | null;
  members: MemberRow[];
  today: string;
  initialTemplate?: string | null;
  /** First save of a new tracker; later saves go through `onUpdate` with the id this returns. */
  onCreate: (input: CreateTrackerInput) => Promise<{ id: string }>;
  onUpdate: (id: string, input: CreateTrackerInput) => Promise<unknown>;
  onArchive?: (archived: boolean) => Promise<unknown>;
  onDelete?: () => Promise<unknown>;
  /** Leaves the editor; `savedId` is the tracker that now exists, if any. */
  onClose: (savedId: string | null) => void;
}) {
  const reduced = useReducedMotion();
  const startTemplate = templateById(initialTemplate) ?? TRACKER_TEMPLATES[0]!;
  const [templateId, setTemplateId] = useState<TrackerTemplate["id"] | null>(editing ? null : startTemplate.id);
  const [defStart, defEnd] = presetRange("quarter", today);
  const [name, setName] = useState(
    editing?.name ?? (startTemplate.title ? `${startTemplate.title} · Q${quarterOf(today)}` : ""),
  );
  const [assigneeId, setAssigneeId] = useState(editing?.assigneeId ?? "");
  const [periodStart, setPeriodStart] = useState(editing?.periodStart ?? defStart);
  const [periodEnd, setPeriodEnd] = useState(editing?.periodEnd ?? defEnd);
  const [split, setSplit] = useState<"day" | "week">(editing?.split ?? "day");
  const [checkIn, setCheckIn] = useState<"daily" | "weekly">(editing?.checkIn ?? "daily");
  const [workingDays, setWorkingDays] = useState<number[]>(editing?.workingDays ?? [1, 2, 3, 4, 5, 6, 7]);
  const [reminderTime, setReminderTime] = useState<string>(editing ? (editing.reminderTime ?? "") : "18:00");
  const [lastReminder, setLastReminder] = useState<string>(editing?.reminderTime ?? "18:00");
  const [metrics, setMetrics] = useState<MetricDraft[]>(() =>
    editing
      ? editing.metrics.map((m) => ({
          id: m.id,
          name: m.name,
          kind: m.kind,
          unit: m.unit,
          currency: m.currency ?? "",
          target: m.target != null ? groupDigits(String(m.target)) : "",
          direction: m.direction,
          formula: m.formula,
        }))
      : fromTemplate(startTemplate),
  );
  const [sync, setSync] = useState<TaskSyncStatus>("idle");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmDialogOptions | null>(null);

  const inputs = metrics.filter((m) => m.kind === "input");
  const preset = presetOf(periodStart, periodEnd, today);

  const units = useMemo(() => {
    if (!periodStart || !periodEnd || periodEnd < periodStart) return 0;
    return trackerSlotKeys({ periodStart, periodEnd, split, checkIn: split === "week" ? "weekly" : "daily", workingDays }).length;
  }, [periodStart, periodEnd, split, workingDays]);

  function applyTemplate(t: TrackerTemplate) {
    setTemplateId(t.id);
    setMetrics(fromTemplate(t));
    // Only replace the name while it is still a template's suggestion.
    if (!name.trim() || TRACKER_TEMPLATES.some((x) => x.title && name.startsWith(x.title))) {
      setName(t.title ? `${t.title} · Q${quarterOf(today)}` : "");
    }
    setError(null);
  }

  function patch(id: string, p: Partial<MetricDraft>) {
    setMetrics((ms) => ms.map((m) => (m.id === id ? { ...m, ...p } : m)));
    setError(null);
  }

  function addMetric(kind: "input" | "formula") {
    if (kind === "formula" && inputs.length < 2) {
      setError("A calculated metric is made from two others — add those first.");
      return;
    }
    setMetrics((ms) => [
      ...ms,
      {
        id: uuid(),
        // Calculated metrics start named after their formula, so adding one never blocks autosave.
        name:
          kind === "formula"
            ? `${inputs[inputs.length - 1]!.name.trim() || "First"} ÷ ${inputs[0]!.name.trim() || "Second"}`
            : "",
        kind,
        unit: kind === "formula" ? "number" : "count",
        currency: "",
        target: "",
        direction: "at_least",
        formula: kind === "formula" ? { op: "div", a: inputs[inputs.length - 1]!.id, b: inputs[0]!.id } : null,
      },
    ]);
  }

  function removeMetric(id: string) {
    setMetrics((ms) => ms.filter((m) => m.id !== id && !(m.formula && (m.formula.a === id || m.formula.b === id))));
  }

  /* ───────────── Autosave, like the task page: debounce, one request at a time, latest wins. ───────────── */

  // What still blocks saving; shown as the indicator's hint rather than as an error.
  const problem = !name.trim()
    ? "Name the tracker to start saving"
    : periodEnd < periodStart
        ? "The period ends before it starts"
        : metrics.some((m) => !m.name.trim())
          ? "Every metric needs a name"
          : inputs.length === 0
            ? "Add a metric to log"
            : null;

  const payloadKey = problem
    ? null
    : JSON.stringify({
        name: name.trim(),
        // Optional: the tracker saves (and shows on the Trackers page) before anyone is assigned.
        assigneeId: assigneeId || null,
        periodStart,
        periodEnd,
        split,
        checkIn,
        workingDays,
        reminderTime: reminderTime || null,
        metrics: metrics.map((m) => ({
          id: m.id,
          name: m.name.trim(),
          kind: m.kind,
          unit: m.unit,
          currency: m.unit === "currency" ? m.currency.trim() || null : null,
          // The server derives calculated targets too; sending ours keeps the request honest.
          target: m.kind === "formula" ? formulaTarget(m, metrics) : num(m.target),
          direction: m.direction,
          formula: m.kind === "formula" ? m.formula : null,
        })),
      } satisfies CreateTrackerInput);

  const savedIdRef = useRef<string | null>(editing?.id ?? null);
  // An existing tracker starts "already saved": opening it must not trigger a write.
  const lastSavedRef = useRef<string | null | undefined>(editing ? undefined : null);
  const latestRef = useRef<string | null>(payloadKey);
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);

  useEffect(() => {
    latestRef.current = payloadKey;
    if (lastSavedRef.current === undefined) {
      lastSavedRef.current = payloadKey;
      return;
    }
    if (!payloadKey || payloadKey === lastSavedRef.current) return;
    setSync("pending");
    const t = setTimeout(() => void flush(), 700);
    return () => clearTimeout(t);
    // `flush` reads only refs, so it never goes stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadKey]);

  async function flush() {
    if (inFlightRef.current) {
      queuedRef.current = true;
      return;
    }
    const key = latestRef.current;
    if (!key || key === lastSavedRef.current) return;
    inFlightRef.current = true;
    setSync("saving");
    try {
      const input = JSON.parse(key) as CreateTrackerInput;
      if (savedIdRef.current) await onUpdate(savedIdRef.current, input);
      else savedIdRef.current = (await onCreate(input)).id;
      lastSavedRef.current = key;
      setSync(latestRef.current === key ? "saved" : "pending");
      setSyncError(null);
    } catch (e) {
      setSync("error");
      setSyncError(e instanceof Error ? e.message : "Couldn't save the tracker.");
    } finally {
      inFlightRef.current = false;
      if (queuedRef.current || (latestRef.current && latestRef.current !== lastSavedRef.current)) {
        queuedRef.current = false;
        void flush();
      }
    }
  }

  /** Leaving saves anything still waiting on the debounce first. */
  async function done() {
    if (latestRef.current && latestRef.current !== lastSavedRef.current) await flush();
    onClose(savedIdRef.current);
  }

  return (
    <div className="mx-auto w-full max-w-[min(100%,104rem)] space-y-5">
      <ConfirmDialog open={confirm != null} options={confirm} onClose={() => setConfirm(null)} />

      {/* Top bar: Back + badge on the left, actions on the right — as on the task page. */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button type="button" onClick={() => void done()} className={`${GHOST_BTN} text-[var(--muted)] hover:text-[var(--fg)]`}>
            <FontAwesomeIcon icon={faArrowLeft} className="size-4" />
            Back
          </button>
          <span className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--fg)]">
            {editing ? "Tracker" : "New tracker"}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <AnimatePresence>
            {error && (
              <motion.span
                key={error}
                role="alert"
                initial={reduced ? false : { opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="hidden text-sm text-red-600 sm:inline dark:text-red-400"
              >
                {error}
              </motion.span>
            )}
          </AnimatePresence>
          {/* Say what blocks saving in words, not only in the indicator's tooltip. */}
          {problem && sync !== "saving" ? (
            <span className="hidden text-xs font-medium text-amber-600 sm:inline dark:text-amber-400">{problem}</span>
          ) : null}
          <TaskFormSyncIndicator status={sync} error={syncError} hint={problem && sync !== "saving" ? problem : null} />
          <button
            type="button"
            onClick={() => void done()}
            className="btn-primary rounded-lg px-3 py-1.5 text-sm font-medium transition-transform duration-150 active:scale-[0.97]"
          >
            Done
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-red-600 sm:hidden dark:text-red-400">{error}</p>}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* ───────────── Main column ───────────── */}
        <div className="min-w-0 flex-1 space-y-4">
          <div className={`${CARD_MAIN} space-y-4`}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Tracker</h3>

            <div>
              <label htmlFor="tracker-name" className={SECTION_LABEL}>
                Tracker name <span className="text-red-500">*</span>
              </label>
              <input
                id="tracker-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. Sales · Q4"
                maxLength={120}
                aria-required
                className="w-full border-b border-[var(--border-subtle)] bg-transparent p-0 pb-1 text-2xl font-semibold leading-snug text-[var(--fg)] outline-none placeholder:text-[var(--muted)]"
              />
            </div>

            {!editing && (
              <div>
                <span className={SECTION_LABEL}>Start from</span>
                <div className="flex flex-wrap gap-2">
                  {TRACKER_TEMPLATES.map((t) => {
                    const on = t.id === templateId;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => applyTemplate(t)}
                        aria-pressed={on}
                        title={t.blurb}
                        className={`relative ${CHIP} ${on ? "" : "!text-[var(--muted)] hover:!text-[var(--fg)]"}`}
                      >
                        {on && (
                          <motion.span
                            layoutId="tracker-template-pick"
                            className="absolute -inset-px rounded-lg border border-[var(--fg)]/60"
                            transition={reduced ? { duration: 0 } : SPRING}
                          />
                        )}
                        <span className="relative">{t.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Targets */}
          <div className={`${CARD_MAIN} space-y-3`}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Targets</h3>
              {units > 0 && (
                <span className="text-xs text-[var(--muted)]">
                  <span className="tabular-nums text-[var(--fg)]">{units}</span> {split === "week" ? "weeks" : "working days"} in the
                  period
                </span>
              )}
            </div>

            <div className={`hidden gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)] sm:grid ${GRID}`}>
              <span className="px-2.5">Metric</span>
              <span>Measured as</span>
              <span>Target</span>
              <span />
            </div>

            <div className="divide-y divide-[var(--border-subtle)]">
              <AnimatePresence initial={false}>
                {metrics.map((m) => {
                  const t = num(m.target);
                  const per = t != null && units > 0 && m.kind === "input" ? t / units : null;
                  return (
                    <motion.div
                      key={m.id}
                      layout={!reduced}
                      initial={reduced ? false : { opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      transition={SPRING}
                    >
                      <div className={`group grid grid-cols-1 items-center gap-2 py-2 ${GRID}`}>
                        <div className="min-w-0">
                          <input
                            value={m.name}
                            onChange={(e) => patch(m.id, { name: e.target.value })}
                            placeholder={m.kind === "formula" ? "Calculated metric" : "Metric name"}
                            maxLength={80}
                            aria-label="Metric name"
                            aria-invalid={!m.name.trim()}
                            className={`${FIELD} font-semibold ${m.name.trim() ? "" : "!border-amber-500/60"}`}
                          />
                          {m.kind === "formula" && m.formula ? (
                            <div className="flex items-center gap-0.5 pl-2.5 text-xs text-[var(--muted)]">
                              <span className="pr-1">=</span>
                              <FormulaPick value={m.formula.a} options={inputs} onChange={(a) => patch(m.id, { formula: { ...m.formula!, a } })} />
                              <Pick
                                value={m.formula.op}
                                onChange={(op) => patch(m.id, { formula: { ...m.formula!, op } })}
                                options={OP_OPTIONS}
                                label="Operation"
                                className={INLINE}
                              >
                                <FontAwesomeIcon icon={OP_ICON[m.formula.op]} className="size-2.5" />
                              </Pick>
                              <FormulaPick value={m.formula.b} options={inputs} onChange={(b) => patch(m.id, { formula: { ...m.formula!, b } })} />
                            </div>
                          ) : per != null ? (
                            <p className="pl-2.5 text-xs text-[var(--muted)]">
                              ≈ <span className="tabular-nums">{compactNumber(per)}</span> {split === "week" ? "a week" : "a day"}
                            </p>
                          ) : null}
                        </div>
                        {m.kind === "formula" ? (
                          <span className="text-sm font-semibold text-[var(--muted)]">Calculated</span>
                        ) : (
                          <div>
                            <Pick value={m.unit} onChange={(unit) => patch(m.id, { unit })} options={UNIT_OPTIONS} label="Measured as" />
                          </div>
                        )}
                        {m.kind === "formula" ? (
                          <div className="flex min-w-0 items-baseline gap-2 px-2.5" title="Worked out from the other targets">
                            <span className="text-sm font-semibold tabular-nums text-[var(--fg)]">
                              {formulaTarget(m, metrics) != null ? compactNumber(formulaTarget(m, metrics)) : "–"}
                              {m.formula?.percent ? "%" : ""}
                            </span>
                            <span className="text-xs text-[var(--muted)]">auto</span>
                          </div>
                        ) : (
                        <div className="flex min-w-0 items-center gap-1">
                          <Pick
                            value={m.direction}
                            onChange={(direction) => patch(m.id, { direction })}
                            options={[
                              { value: "at_least", label: "At least" },
                              { value: "at_most", label: "At most" },
                            ]}
                            label="At least or at most"
                            className="shrink-0 px-2"
                          >
                            <span className="text-[var(--muted)]">{m.direction === "at_most" ? "≤" : "≥"}</span>
                          </Pick>
                          <input
                            value={m.target}
                            onChange={(e) => patch(m.id, { target: groupDigits(e.target.value) })}
                            inputMode="decimal"
                            placeholder="Target"
                            aria-label={`${m.name || "Metric"} target`}
                            className={`${FIELD} min-w-0 font-semibold tabular-nums`}
                          />
                        </div>
                        )}
                        {metrics.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeMetric(m.id)}
                            aria-label={`Remove ${m.name || "metric"}`}
                            className="inline-flex size-8 items-center justify-center rounded-lg text-[var(--muted)] opacity-0 transition-[opacity,background-color,transform] duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--fg)] focus:opacity-100 active:scale-[0.94] group-hover:opacity-100"
                          >
                            <FontAwesomeIcon icon={faXmark} className="size-3" />
                          </button>
                        ) : (
                          <span />
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-3">
              <button type="button" onClick={() => addMetric("input")} className={`${GHOST_BTN} text-[var(--muted)] hover:text-[var(--fg)]`}>
                <FontAwesomeIcon icon={faPlus} className="size-3" />
                Add metric
              </button>
              <button
                type="button"
                onClick={() => addMetric("formula")}
                title="Worked out from two others, like revenue ÷ orders"
                className={`${GHOST_BTN} text-[var(--muted)] hover:text-[var(--fg)]`}
              >
                <FontAwesomeIcon icon={faCalculator} className="size-3" />
                Add calculated
              </button>
            </div>
          </div>
        </div>

        {/* ───────────── Sidebar: one card with section labels, then toggle cards — as on the task page ───────────── */}
        <div className="w-full space-y-4 lg:w-72 lg:shrink-0">
          <div className={`${CARD_SIDE} space-y-4`}>
            <div>
              <span className={SECTION_LABEL}>Assigned to</span>
              <PersonSearchField
                members={members}
                allowNone
                value={assigneeId}
                onChange={(v) => {
                  setAssigneeId(v);
                  setError(null);
                }}
              />
              <p className="mt-1.5 text-xs text-[var(--muted)]">One person per tracker. You can assign it later.</p>
            </div>

            <div>
              <span className={SECTION_LABEL}>Period</span>
              <div className="flex flex-col items-start gap-2">
                <PickerChip type="date" value={periodStart} onChange={setPeriodStart} label={`From ${shortDate(periodStart)}`} icon={faCalendar} ariaLabel="Start date" />
                <PickerChip type="date" value={periodEnd} onChange={setPeriodEnd} label={`To ${shortDate(periodEnd)}`} icon={faCalendar} ariaLabel="End date" />
              </div>
              <div className="mt-2 flex gap-3 text-xs">
                {(["month", "quarter", "year"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      const [s, e] = presetRange(p, today);
                      setPeriodStart(s);
                      setPeriodEnd(e);
                    }}
                    className={`transition-colors duration-150 ${preset === p ? "font-semibold text-[var(--fg)]" : "text-[var(--muted)] hover:text-[var(--fg)]"}`}
                  >
                    This {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className={SECTION_LABEL}>Target split</span>
              <Segmented
                value={split}
                onChange={setSplit}
                size="md"
                aria-label="Target split"
                options={[
                  { value: "day", label: "Per day" },
                  { value: "week", label: "Per week" },
                ]}
              />
            </div>

            <div>
              <span className={SECTION_LABEL}>Logs progress</span>
              <Segmented
                value={checkIn}
                onChange={setCheckIn}
                size="md"
                aria-label="Logs progress"
                options={[
                  { value: "daily", label: "Daily" },
                  { value: "weekly", label: "Weekly" },
                ]}
              />
            </div>

            <div>
              <span className={SECTION_LABEL}>Working days</span>
              <div className="flex gap-1">
                {DAY_LETTERS.map((d, i) => {
                  const iso = i + 1;
                  const on = workingDays.includes(iso);
                  return (
                    <button
                      key={iso}
                      type="button"
                      aria-pressed={on}
                      aria-label={DAY_NAMES[i]}
                      title={DAY_NAMES[i]}
                      onClick={() =>
                        setWorkingDays((w) => (on ? (w.length > 1 ? w.filter((x) => x !== iso) : w) : [...w, iso].sort()))
                      }
                      className={`size-8 rounded-lg text-xs font-semibold transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.94] ${
                        on
                          ? "border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--fg)]"
                          : "text-[var(--muted)] hover:bg-[var(--surface-hover)]"
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Toggle card, like "Show time tracking" on the task page. */}
          <div className={`${CARD_SIDE} space-y-3`}>
            <div className="flex items-center justify-between gap-2 text-sm font-semibold text-[var(--fg)]">
              <span>Send a reminder</span>
              <Toggle
                checked={Boolean(reminderTime)}
                onChange={(next) => {
                  if (next) setReminderTime(lastReminder);
                  else {
                    if (reminderTime) setLastReminder(reminderTime);
                    setReminderTime("");
                  }
                }}
                aria-label="Send a reminder"
              />
            </div>
            <AnimatePresence initial={false}>
              {reminderTime && (
                <motion.div
                  initial={reduced ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
                  exit={{ height: 0, opacity: 0, overflow: "hidden" }}
                  transition={{ duration: reduced ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                  style={{ overflow: "hidden" }}
                  className="space-y-1.5"
                >
                  <PickerChip type="time" value={reminderTime} onChange={setReminderTime} label={timeLabel(reminderTime)} icon={faClock} ariaLabel="Reminder time" />
                  <p className="text-xs text-[var(--muted)]">
                    {checkIn === "weekly" ? "On the last working day, if the week isn’t logged." : "On working days, if the day isn’t logged."}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {editing && (onArchive || onDelete) && (
            <div className="flex flex-col gap-2">
              {onArchive && (
                <button
                  type="button"
                  onClick={() => void onArchive(!editing.archivedAt)}
                  className={`${GHOST_BTN} w-full justify-center text-[var(--muted)] hover:text-[var(--fg)]`}
                >
                  {editing.archivedAt ? "Unarchive tracker" : "Archive tracker"}
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() =>
                    setConfirm({
                      title: "Delete this tracker?",
                      description: "Every log on it is deleted too. Archive it instead to keep the history.",
                      confirmLabel: "Delete tracker",
                      variant: "danger",
                      onConfirm: async () => {
                        await onDelete();
                      },
                    })
                  }
                  className="inline-flex w-full items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition-[background-color,transform] duration-150 hover:bg-red-500/10 active:scale-[0.97] dark:text-red-400"
                >
                  Delete tracker
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FormulaPick({
  value,
  options,
  onChange,
}: {
  value: string;
  options: MetricDraft[];
  onChange: (id: string) => void;
}) {
  return (
    <Pick
      value={value}
      onChange={onChange}
      options={options.map((o) => ({ value: o.id, label: o.name.trim() || "Untitled" }))}
      label="Metric"
      className={`${INLINE} max-w-[9rem]`}
    />
  );
}
