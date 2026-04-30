"use client";

import { useCallback, useId, useMemo, type ChangeEvent } from "react";
import type { TaskDueRepeat } from "@/lib/ledger-types";

type DueDateTimePanelProps = {
  /** `datetime-local` shape (`YYYY-MM-DDTHH:mm`) or `""`. */
  value: string;
  onChange: (localValue: string) => void;
  onClear: () => void;
  /** Tighter layout for popover. */
  compact?: boolean;
  /** Shown below time when set; omit to hide repeat controls. */
  dueRepeat?: TaskDueRepeat | null;
  onDueRepeatChange?: (next: TaskDueRepeat | null) => void;
};

const REPEAT_OPTIONS: { value: TaskDueRepeat; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseDueLocalValue(s: string): Date | null {
  const t = s.trim();
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDueLocalString(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function mergeCalendarDayWithTime(day: Date, hour: number, minute: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, 0, 0);
}

/** Same native `type="date"` shell as the task page due filter toolbar. */
const DUE_DATE_INPUT_CLASS = "input h-10 min-w-0 w-full flex-1 rounded-lg text-sm";

/** Single due: native date + time (matches task filter date inputs). */
export function DueDateTimePanel({ value, onChange, onClear, compact, dueRepeat, onDueRepeatChange }: DueDateTimePanelProps) {
  const selected = useMemo(() => parseDueLocalValue(value), [value]);

  const dateInputValue = useMemo(() => {
    const t = value.trim();
    if (!t) return "";
    const m = t.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1]! : "";
  }, [value]);

  const onDateInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const d = e.target.value;
      if (!d) {
        onChange("");
        return;
      }
      const h = selected?.getHours() ?? 9;
      const m = selected?.getMinutes() ?? 0;
      const base = new Date(`${d}T${pad2(h)}:${pad2(m)}`);
      if (Number.isNaN(base.getTime())) return;
      onChange(toDueLocalString(base));
    },
    [onChange, selected],
  );

  const timeFieldId = useId();

  const onTimeInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const datePart = dateInputValue;
      if (!datePart) return;
      const t = e.target.value;
      if (!t) return;
      const parts = t.split(":");
      const h = Number(parts[0]);
      const min = Number(parts[1]);
      if (Number.isNaN(h) || Number.isNaN(min)) return;
      const [y, mo, da] = datePart.split("-").map(Number);
      if (!y || !mo || !da) return;
      onChange(toDueLocalString(mergeCalendarDayWithTime(new Date(y, mo - 1, da), h, min)));
    },
    [onChange, dateInputValue],
  );

  const timeInputValue = selected ? `${pad2(selected.getHours())}:${pad2(selected.getMinutes())}` : "";

  const labelClass = `block font-medium text-[var(--muted)] ${compact ? "text-[10px] uppercase tracking-wide" : "text-xs"}`;
  const sectionGap = compact ? "mt-2 space-y-1 pt-2" : "mt-3 space-y-1.5 pt-3";

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <div className="flex items-center justify-between gap-2">
        <span className={`font-medium text-[var(--muted)] ${compact ? "text-[10px] uppercase tracking-wide" : "text-xs"}`}>
          {compact ? "Pick due" : "Due (date & time)"}
        </span>
        <button
          type="button"
          className={`btn-secondary shrink-0 rounded-md text-[var(--muted)] hover:text-[var(--fg)] ${compact ? "px-2 py-0.5 text-[10px]" : "rounded-lg px-2.5 py-1 text-[11px]"}`}
          disabled={!value.trim()}
          onClick={() => onClear()}
        >
          Clear
        </button>
      </div>

      <div
        className={`overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] ${compact ? "p-2" : "p-2 sm:p-3"}`}
      >
        <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">Due date</p>
        <input
          type="date"
          className={`${DUE_DATE_INPUT_CLASS} mt-1`}
          value={dateInputValue}
          onChange={onDateInputChange}
          aria-label="Due date"
        />

        <div className={`border-t border-[var(--border-subtle)] ${sectionGap}`}>
          <label htmlFor={timeFieldId} className={labelClass}>
            Time
          </label>
          <input
            id={timeFieldId}
            type="time"
            step={60}
            className={`${DUE_DATE_INPUT_CLASS} mt-1`}
            aria-label="Due time"
            disabled={!dateInputValue}
            value={timeInputValue}
            onChange={onTimeInputChange}
          />
        </div>

        {onDueRepeatChange && selected ? (
          <div className={`border-t border-[var(--border-subtle)] ${compact ? "mt-2 space-y-1.5 pt-2" : "mt-3 space-y-2 pt-3"}`}>
            <span className={labelClass}>Repeat</span>
            <div className={`grid ${compact ? "grid-cols-2 gap-1" : "grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2"}`}>
              {REPEAT_OPTIONS.map(({ value: rv, label }) => {
                const active = dueRepeat === rv;
                return (
                  <button
                    key={rv}
                    type="button"
                    onClick={() => onDueRepeatChange(active ? null : rv)}
                    aria-pressed={active}
                    className={`rounded-md border px-2 py-1.5 text-center text-[11px] font-medium transition-colors ${
                      active
                        ? "border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--fg)]"
                        : "border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-[var(--muted)] hover:border-[var(--border)] hover:text-[var(--fg)]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {!compact ? (
              <p className="text-[10px] leading-snug text-[var(--muted)]">
                Stored with the task; generation of next occurrences is not wired yet.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {!compact ? (
        <p className="text-[11px] text-[var(--muted)]">
          Native date and time controls (same style as the task list due filter). Stored as a single instant in your
          device&apos;s local timezone.
        </p>
      ) : null}
    </div>
  );
}
