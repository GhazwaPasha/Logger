"use client";

import type { TaskSyncStatus } from "@/hooks/useTaskAutoSync";
import { CheckIcon, CircleAlertIcon, CloudUploadIcon, LoaderCircleIcon } from "lucide-react";

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
        "border-[color-mix(in_srgb,var(--danger)_80%,transparent)] bg-[var(--danger)] text-[var(--danger)] dark:border-[color-mix(in_srgb,var(--danger)_50%,transparent)] dark:bg-[color-mix(in_srgb,var(--danger)_40%,transparent)] dark:text-[var(--danger)]",
      icon: <CircleAlertIcon className="size-3.5 shrink-0" aria-hidden />,
    };
  }
  if (status === "saving") {
    return {
      label: "Saving",
      title: "Saving your changes…",
      className: "border-[var(--accent)]/35 bg-[var(--accent-muted)] text-[var(--fg)]",
      icon: (
        <LoaderCircleIcon
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
      icon: <CloudUploadIcon className="size-3.5 shrink-0 text-[var(--accent)]" aria-hidden />,
      pulse: true,
    };
  }
  if (status === "saved") {
    return {
      label: "Saved",
      title: "All changes saved",
      className:
        "border-[color-mix(in_srgb,var(--success)_80%,transparent)] bg-[var(--success)] text-[var(--success)] dark:border-[color-mix(in_srgb,var(--success)_50%,transparent)] dark:bg-[color-mix(in_srgb,var(--success)_35%,transparent)] dark:text-[var(--success)]",
      icon: <CheckIcon className="size-3.5 shrink-0" aria-hidden />,
    };
  }
  if (hint) {
    return {
      label: "Draft",
      title: hint,
      className: "border-dashed border-[var(--border-subtle)] bg-transparent text-[var(--muted)]",
      icon: <CloudUploadIcon className="size-3.5 shrink-0 opacity-50" aria-hidden />,
    };
  }
  return {
    label: "Auto-save",
    title: "Changes save automatically when you edit",
    className: "border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-[var(--muted)]",
    icon: <CloudUploadIcon className="size-3.5 shrink-0 opacity-50" aria-hidden />,
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
        className={`inline-flex h-7 min-w-[5.75rem] items-center justify-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition-colors duration-200 ${cfg.className} ${cfg.pulse ? "animate-pulse motion-reduce:animate-none" : ""}`}
      >
        {cfg.icon}
        <span className="tabular-nums">{cfg.label}</span>
      </span>
      {showDetail && (
        <span className="max-w-[12rem] truncate text-right text-2xs font-medium text-[var(--danger)] dark:text-[var(--danger)]">
          {error}
        </span>
      )}
    </div>
  );
}
