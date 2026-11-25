"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/primitives/dialog";
import { XIcon } from "lucide-react";

export type ExportRange = { dateFrom: string; dateTo: string };

type PresetKey = "1d" | "3d" | "1w" | "1m" | "lastWeek" | "lastMonth" | "custom";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "1d", label: "1 Day" },
  { key: "3d", label: "3 Days" },
  { key: "1w", label: "1 Week" },
  { key: "1m", label: "1 Month" },
  { key: "lastWeek", label: "Last Week" },
  { key: "lastMonth", label: "Last Month" },
  { key: "custom", label: "Custom Range" },
];

function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

/** Rolling window ending now, matching the style of the KPI date-range presets elsewhere on the page. */
function rollingRange(days: number): ExportRange {
  const dateTo = new Date();
  const dateFrom = new Date(dateTo.getTime() - days * 24 * 60 * 60 * 1000);
  return { dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() };
}

/** The calendar week (Mon–Sun) before the current one. */
function lastWeekRange(): ExportRange {
  const now = new Date();
  const diffToMonday = (now.getDay() + 6) % 7;
  const thisMonday = startOfDay(new Date(now.getTime() - diffToMonday * 24 * 60 * 60 * 1000));
  const lastMonday = new Date(thisMonday.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lastSunday = new Date(thisMonday.getTime() - 1);
  return { dateFrom: lastMonday.toISOString(), dateTo: lastSunday.toISOString() };
}

/** The calendar month before the current one. */
function lastMonthRange(): ExportRange {
  const now = new Date();
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastOfLastMonth = new Date(firstOfThisMonth.getTime() - 1);
  return { dateFrom: firstOfLastMonth.toISOString(), dateTo: lastOfLastMonth.toISOString() };
}

export function PerformanceExportModal({
  open,
  busy,
  onClose,
  onExport,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onExport: (range: ExportRange) => void;
}) {
  const today = new Date();
  const [preset, setPreset] = useState<PresetKey>("1w");
  const [customFrom, setCustomFrom] = useState(toDateInputValue(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)));
  const [customTo, setCustomTo] = useState(toDateInputValue(today));

  const rangeForPreset = (key: PresetKey): ExportRange | null => {
    switch (key) {
      case "1d":
        return rollingRange(1);
      case "3d":
        return rollingRange(3);
      case "1w":
        return rollingRange(7);
      case "1m":
        return rollingRange(30);
      case "lastWeek":
        return lastWeekRange();
      case "lastMonth":
        return lastMonthRange();
      case "custom": {
        if (!customFrom || !customTo || customFrom > customTo) return null;
        return {
          dateFrom: startOfDay(new Date(`${customFrom}T00:00:00`)).toISOString(),
          dateTo: endOfDay(new Date(`${customTo}T00:00:00`)).toISOString(),
        };
      }
    }
  };

  const invalidCustom = preset === "custom" && (!customFrom || !customTo || customFrom > customTo);

  const handleExport = () => {
    const range = rangeForPreset(preset);
    if (!range) return;
    onExport(range);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <DialogContent showCloseButton={false} overlayClassName="z-[130]" className="z-[130] gap-0 p-6 sm:max-w-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[var(--muted)]">Export</p>
                <DialogTitle className="mt-0.5 text-lg font-semibold text-[var(--fg)]">Performance report</DialogTitle>
              </div>
              <button
                type="button"
                className="rounded-lg p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)] disabled:opacity-50"
                onClick={onClose}
                disabled={busy}
                aria-label="Close"
              >
                <XIcon className="size-5" />
              </button>
            </div>

            <p className="mt-3 text-sm text-[var(--muted)]">Choose the time range to include in the CSV.</p>

            <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className={`rounded-lg px-3 py-2.5 text-xs font-medium transition-colors sm:py-2 ${
                    preset === p.key
                      ? "bg-primary text-on-primary"
                      : "bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
                  }`}
                  onClick={() => setPreset(p.key)}
                  aria-pressed={preset === p.key}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {preset === "custom" && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[var(--muted)]">
                    From
                  </label>
                  <input
                    type="date"
                    className="input w-full rounded-lg px-3 py-2 text-sm"
                    value={customFrom}
                    max={customTo || undefined}
                    onChange={(e) => setCustomFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[var(--muted)]">
                    To
                  </label>
                  <input
                    type="date"
                    className="input w-full rounded-lg px-3 py-2 text-sm"
                    value={customTo}
                    min={customFrom || undefined}
                    onChange={(e) => setCustomTo(e.target.value)}
                  />
                </div>
              </div>
            )}
            {invalidCustom && <p className="mt-1.5 text-xs text-[var(--danger)]">Pick a valid date range.</p>}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="pressable h-10 rounded-xl bg-fill-2 px-4 text-sm font-medium text-ink hover:bg-fill-3"
                onClick={onClose}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="pressable h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary hover:opacity-90 disabled:opacity-60"
                onClick={handleExport}
                disabled={busy || invalidCustom}
              >
                {busy ? "Exporting…" : "Export CSV"}
              </button>
            </div>
      </DialogContent>
    </Dialog>
  );
}
