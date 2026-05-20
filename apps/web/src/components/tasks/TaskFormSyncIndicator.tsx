"use client";

import { Check, CircleNotch, CloudArrowUp, WarningCircle } from "@phosphor-icons/react";
import type { TaskSyncStatus } from "@/hooks/useTaskAutoSync";

type IndicatorConfig = {
  label: string;
  title: string;
  className: string;
  icon: React.ReactNode;
  pulse?: boolean;
};

function configFor(status: TaskSyncStatus, error: string | null, hint: string | null): IndicatorConfig {
  if (status === "error") {
    return {
      label: "Save failed",
      title: error ?? "Could not save",
      className:
        "border-red-200/80 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400",
      icon: <WarningCircle weight="fill" className="size-3.5 shrink-0" aria-hidden />,
    };
  }
  if (status === "saving") {
    return {
      label: "Saving",
      title: "Saving your changes…",
      className: "border-[var(--accent)]/35 bg-[var(--accent-muted)] text-[var(--fg)]",
      icon: (
        <CircleNotch
          weight="bold"
          className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
          aria-hidden
        />
      ),
    };
  }
  if (status === "pending") {
    return {
      label: "Pending",
      title: "Changes will save shortly",
      className: "border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--muted)]",
      icon: <CloudArrowUp weight="bold" className="size-3.5 shrink-0 text-[var(--accent)]" aria-hidden />,
      pulse: true,
    };
  }
  if (status === "saved") {
    return {
      label: "Saved",
      title: "All changes saved",
      className:
        "border-green-200/80 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/35 dark:text-green-400",
      icon: <Check weight="bold" className="size-3.5 shrink-0" aria-hidden />,
    };
  }
  if (hint) {
    return {
      label: "Draft",
      title: hint,
      className: "border-dashed border-[var(--border-subtle)] bg-transparent text-[var(--muted)]",
      icon: <CloudArrowUp weight="bold" className="size-3.5 shrink-0 opacity-50" aria-hidden />,
    };
  }
  return {
    label: "Auto-save",
    title: "Changes save automatically when you edit",
    className: "border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-[var(--muted)]",
    icon: <CloudArrowUp weight="bold" className="size-3.5 shrink-0 opacity-50" aria-hidden />,
  };
}

export function TaskFormSyncIndicator({
  status,
  error,
  hint,
}: {
  status: TaskSyncStatus;
  error?: string | null;
  hint?: string | null;
}) {
  const cfg = configFor(status, error ?? null, hint ?? null);
  const showDetail = status === "error" && error;

  return (
    <div
      className="flex shrink-0 flex-col items-end gap-0.5 sm:min-w-[6.75rem]"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span
        title={cfg.title}
        className={`inline-flex h-7 min-w-[5.75rem] items-center justify-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold uppercase tracking-wide transition-colors duration-200 ${cfg.className} ${cfg.pulse ? "animate-pulse motion-reduce:animate-none" : ""}`}
      >
        {cfg.icon}
        <span className="tabular-nums">{cfg.label}</span>
      </span>
      {showDetail && (
        <span className="max-w-[12rem] truncate text-right text-[10px] font-medium text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
    </div>
  );
}
