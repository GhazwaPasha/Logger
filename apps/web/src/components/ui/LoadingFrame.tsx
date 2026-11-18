"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { LogBaseMark } from "@/components/brand/LogBaseMark";

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

const BOOT_TEXT = "Preparing your Logs";
const BOOT_WORDS = BOOT_TEXT.split(" ");

/**
 * Sign-in mounts this screen several times in a row (boot provider → session → workspace shell →
 * route Suspense). Only the first mount plays the entrance; a remount within this window shows the
 * settled state at once, so the logo and words never replay or flicker between hand-offs.
 */
const REPLAY_WINDOW_MS = 2000;
let lastBootShownAt = 0;

/** Full-screen boot screen shown during login + session bootstrap + route load. */
export function AppBootScreen() {
  // Decided once per mount, before paint, so the first frame already has the right class.
  const [settled] = useState(() => Date.now() - lastBootShownAt < REPLAY_WINDOW_MS);
  useEffect(() => {
    lastBootShownAt = Date.now();
    return () => {
      lastBootShownAt = Date.now();
    };
  }, []);

  return (
    <div
      className={`boot-screen relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--sheet)] px-6 ${settled ? "boot-screen--settled" : ""}`}
      role="status"
      aria-busy
      aria-label={BOOT_TEXT}
    >
      <div className="relative z-[1] mb-[18vh] flex w-full max-w-3xl flex-col items-center text-center">
        <span className="boot-mark">
          <LogBaseMark size={64} decorative />
        </span>
        <p className="font-outfit mt-6 whitespace-nowrap text-[1.75rem] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--ink)] sm:text-[2.5rem]" aria-hidden>
          {BOOT_WORDS.map((word, i) => (
            <span key={word} className="boot-word" style={{ "--i": i } as React.CSSProperties}>
              {word}
              {i < BOOT_WORDS.length - 1 ? " " : null}
            </span>
          ))}
        </p>
        <span className="boot-track mt-7" aria-hidden>
          <span className="boot-thumb" />
        </span>
      </div>
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
