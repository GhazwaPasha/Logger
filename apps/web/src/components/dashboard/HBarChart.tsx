"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";

export type BarRow = {
  key: string;
  label: string;
  value: number;
  href?: string;
  /** Person rows get their avatar beside the name. */
  avatar?: { name?: string | null; email?: string | null; image?: string | null };
};

const TICKS = 4;
/** Gap between neighbouring bars starting to grow (ms). */
const BAR_STAGGER_MS = 60;

/** A round axis maximum ≥ `max` that splits into TICKS whole steps (1, 2, 5 × 10ⁿ per step). */
function niceMax(max: number) {
  if (max <= 0) return TICKS;
  const raw = max / TICKS;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  return Math.max(TICKS, Math.ceil(step) * TICKS);
}

/**
 * Horizontal bar chart: names down the left, bars growing from a shared baseline across faint gridlines at round
 * steps, the value just past each bar's end, and the axis numbers underneath. The leader is drawn in full colour
 * and the rest a shade lighter. Sits straight on the page — no card.
 */
export function HBarChart({
  title,
  total,
  rows,
  color,
  emptyLabel,
  loading,
  growDelay = 0,
}: {
  title: string;
  /** Shown quietly beside the title, e.g. "59 open". */
  total?: string;
  rows: BarRow[];
  color: string;
  emptyLabel: string;
  loading: boolean;
  /** Ms after mount before the bars grow, so they play once the panel's entrance has landed. */
  growDelay?: number;
}) {
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const axisMax = niceMax(sorted[0]?.value ?? 0);
  const ticks = Array.from({ length: TICKS + 1 }, (_, i) => Math.round((axisMax / TICKS) * i));

  // Bars mount at zero and grow once, after the data lands (a CSS width transition does the easing).
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    if (loading || grown) return;
    const t = window.setTimeout(() => setGrown(true), growDelay);
    return () => window.clearTimeout(t);
  }, [loading, grown, growDelay]);

  return (
    <section className="px-1 py-1.5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-outfit text-base font-semibold tracking-tight">{title}</h2>
        {total ? <span className="text-xs tabular-nums text-[var(--muted)]">{total}</span> : null}
      </div>

      {loading ? (
        <div className="space-y-2.5 py-1" aria-hidden>
          {[80, 55, 35].map((w) => (
            <div
              key={w}
              className="h-3.5 animate-pulse rounded bg-[var(--surface-muted)] motion-reduce:animate-none"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{emptyLabel}</p>
      ) : (
        <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
          <ul>
            {sorted.map((r, i) => {
              const label = (
                <>
                  {r.avatar ? (
                    <Avatar
                      name={r.avatar.name}
                      email={r.avatar.email}
                      image={r.avatar.image}
                      size="h-6 w-6"
                      className="bg-[var(--surface-muted)] text-[10px] font-semibold uppercase"
                    />
                  ) : null}
                  <span
                    className={`min-w-0 truncate text-[13px] ${i === 0 ? "font-semibold text-[var(--fg)]" : "font-medium text-[var(--muted)]"}`}
                  >
                    {r.label}
                  </span>
                </>
              );
              return (
                <li key={r.key} className="flex h-[30px] items-center pr-3" title={`${r.label}: ${r.value}`}>
                  {r.href ? (
                    <Link
                      href={r.href}
                      className="flex min-w-0 items-center gap-2 rounded-md no-underline hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    >
                      {label}
                    </Link>
                  ) : (
                    <span className="flex min-w-0 items-center gap-2">{label}</span>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="relative mr-9">
            {/* Gridlines at each tick, behind the bars. */}
            <div className="pointer-events-none absolute inset-x-0 top-0 bottom-5" aria-hidden>
              {ticks.map((t, i) => (
                <span
                  key={t}
                  className="absolute inset-y-0 w-px bg-[var(--fg)]"
                  style={{ left: `${(i / TICKS) * 100}%`, opacity: i === 0 ? 0.18 : 0.07 }}
                />
              ))}
            </div>

            {sorted.map((r, i) => (
              <div key={r.key} className="relative flex h-[30px] items-center">
                <div
                  className="h-3.5 rounded-r-[7px] rounded-l-[3px] transition-[width] duration-[650ms] ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none"
                  style={{
                    width: grown ? `${(r.value / axisMax) * 100}%` : "0%",
                    minWidth: r.value > 0 ? 4 : 0,
                    backgroundColor: i === 0 ? color : `color-mix(in srgb, ${color} 55%, transparent)`,
                    transitionDelay: `${i * BAR_STAGGER_MS}ms`,
                  }}
                />
                <span className="ml-1.5 w-9 -mr-9 text-xs font-semibold tabular-nums">{r.value}</span>
              </div>
            ))}

            {/* Axis numbers under the gridlines. */}
            <div className="relative mt-0.5 h-5" aria-hidden>
              {ticks.map((t, i) => (
                <span
                  key={t}
                  className={`absolute top-0.5 w-8 text-center text-[10px] tabular-nums text-[var(--muted)] ${i === 0 ? "" : "-ml-4"}`}
                  style={{ left: i === 0 ? 0 : `${(i / TICKS) * 100}%`, textAlign: i === 0 ? "left" : "center" }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
