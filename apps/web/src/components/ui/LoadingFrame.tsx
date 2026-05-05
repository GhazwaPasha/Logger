"use client";

import type { ReactNode } from "react";

const RIBBON_ROUND: Record<"default" | "2xl", string> = {
  default: "",
  "2xl": "task-sync-ribbon-track--rounded-2xl",
};

/**
 * Wraps content with the same accent sync ribbon + tinted chrome used on task rows/cards
 * while data is loading or saving (dashboard panels, org settings, etc.).
 */
export function LoadingFrame({
  show,
  children,
  className = "",
  ribbonRadius = "default",
  padForRibbon = true,
  "aria-label": ariaLabel,
}: {
  show: boolean;
  children: ReactNode;
  className?: string;
  /** Match the host surface’s top corner radius (`2xl` for dashboard / full-page cards). */
  ribbonRadius?: keyof typeof RIBBON_ROUND;
  /** Add slight top padding when the ribbon is visible so content doesn’t touch it. */
  padForRibbon?: boolean;
  "aria-label"?: string;
}) {
  if (!show) return <>{children}</>;

  const round = RIBBON_ROUND[ribbonRadius];
  return (
    <div
      className={`relative overflow-hidden border-[color-mix(in_srgb,var(--accent)_22%,var(--border-subtle))] bg-[color-mix(in_srgb,var(--surface-base)_96%,var(--accent-muted))] transition-[border-color,background-color] duration-200 ${className}`}
      aria-busy
      aria-label={ariaLabel ?? "Loading"}
    >
      <div className={`task-sync-ribbon-track ${round}`} aria-hidden>
        <div className="task-sync-ribbon-thumb" />
      </div>
      <div className={padForRibbon ? "pt-1" : undefined}>{children}</div>
    </div>
  );
}

/** Centered full-viewport placeholder (workspace list, session bootstrap, route Suspense). */
export function LoadingScreen({
  label,
  secondaryLabel,
}: {
  label?: string;
  secondaryLabel?: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--surface-base)] p-6">
      <LoadingFrame
        show
        className="surface-elevated w-full max-w-md rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm"
        ribbonRadius="2xl"
        aria-label={label ?? "Loading"}
      >
        <div className="space-y-4">
          <div className="space-y-2.5" aria-hidden>
            <div className="h-3 w-3/4 max-w-[14rem] animate-pulse rounded-md bg-[var(--surface-muted)] motion-reduce:animate-none" />
            <div className="h-3 w-1/2 max-w-[10rem] animate-pulse rounded-md bg-[var(--surface-muted)] motion-reduce:animate-none" />
            <div className="h-3 w-2/3 max-w-[12rem] animate-pulse rounded-md bg-[var(--surface-muted)] motion-reduce:animate-none" />
          </div>
          {label ? (
            <p className="text-center text-sm font-medium text-[var(--fg)]">{label}</p>
          ) : null}
          {secondaryLabel ? <p className="text-center text-xs text-[var(--muted)]">{secondaryLabel}</p> : null}
        </div>
      </LoadingFrame>
    </div>
  );
}

/** Terminal / list placeholder: ribbon + ragged mono-width bars. */
export function LoadingLinesBlock({
  lines = 5,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  const widths = ["w-[92%]", "w-[78%]", "w-[85%]", "w-[64%]", "w-[88%]", "w-[71%]", "w-[80%]"];
  return (
    <div className={`space-y-2.5 ${className}`} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className={`h-2.5 animate-pulse rounded-sm bg-[var(--surface-muted)] motion-reduce:animate-none ${widths[i % widths.length]}`}
        />
      ))}
    </div>
  );
}
