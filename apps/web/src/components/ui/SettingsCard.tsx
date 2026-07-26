"use client";

import type { ReactNode } from "react";
import { FontAwesomeIcon, type FontAwesomeIconProps } from "@fortawesome/react-fontawesome";

export function SettingsCard({
  icon,
  title,
  description,
  tone = "default",
  children,
}: {
  icon: FontAwesomeIconProps["icon"];
  title: string;
  description?: string;
  tone?: "default" | "danger";
  children: ReactNode;
}) {
  const isDanger = tone === "danger";
  return (
    <section
      className={
        isDanger
          ? "rounded-2xl border border-red-500/40 bg-red-500/[0.04] p-6 dark:bg-red-500/[0.06] sm:p-7"
          : "surface-elevated ui-elevated-panel rounded-2xl border border-[var(--border-subtle)] p-6 sm:p-7"
      }
    >
      <div className="flex items-start gap-3">
        <span
          className={
            isDanger
              ? "flex size-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400"
              : "flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-muted)] text-[var(--accent)]"
          }
        >
          <FontAwesomeIcon icon={icon} className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className={isDanger ? "text-sm font-semibold text-red-700 dark:text-red-300" : "text-sm font-semibold"}>
            {title}
          </h2>
          {description && (
            <p className={isDanger ? "mt-0.5 text-xs text-red-700/80 dark:text-red-300/75" : "mt-0.5 text-xs text-[var(--muted)]"}>
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function SettingsFieldRow({
  label,
  htmlFor,
  children,
  action,
}: {
  label: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <label htmlFor={htmlFor} className="text-xs font-medium text-[var(--muted)] sm:w-36 sm:shrink-0">
        {label}
      </label>
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">{children}</div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
