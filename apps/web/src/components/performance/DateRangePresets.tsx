"use client";

import { Segmented } from "@/components/ui/Segmented";

export type DateRangePreset = 0 | 7 | 30 | 90;

export function presetToRange(days: DateRangePreset): { dateFrom: string; dateTo: string } {
  const dateTo = new Date();
  if (days === 0) {
    const dateFrom = new Date(dateTo);
    dateFrom.setHours(0, 0, 0, 0);
    return { dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() };
  }
  const dateFrom = new Date(dateTo.getTime() - days * 24 * 60 * 60 * 1000);
  return { dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() };
}

export function DateRangePresets({
  value,
  onChange,
}: {
  value: DateRangePreset;
  onChange: (days: DateRangePreset) => void;
}) {
  const options: { days: DateRangePreset; label: string }[] = [
    { days: 0, label: "Today" },
    { days: 7, label: "7 days" },
    { days: 30, label: "30 days" },
    { days: 90, label: "90 days" },
  ];
  return (
    <Segmented
      value={String(value)}
      onChange={(v) => onChange(Number(v) as DateRangePreset)}
      aria-label="Date range"
      options={options.map((o) => ({ value: String(o.days), label: o.label }))}
    />
  );
}
