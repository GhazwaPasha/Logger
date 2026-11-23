"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";

const PAD_TOP = 10;
const PAD_BOTTOM = 22;

/** Smooth path through points (Catmull-Rom → cubic Bézier), clamped so it never dips below the floor. */
function smoothPath(xs: number[], ys: number[], floor: number): string {
  if (xs.length === 0) return "";
  let d = `M${xs[0]} ${ys[0]}`;
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i - 1] ?? xs[i], y0 = ys[i - 1] ?? ys[i];
    const x3 = xs[i + 2] ?? xs[i + 1], y3 = ys[i + 2] ?? ys[i + 1];
    const c1x = xs[i] + (xs[i + 1] - x0) / 6, c1y = Math.min(floor, ys[i] + (ys[i + 1] - y0) / 6);
    const c2x = xs[i + 1] - (x3 - xs[i]) / 6, c2y = Math.min(floor, ys[i + 1] - (y3 - ys[i]) / 6);
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${xs[i + 1].toFixed(1)} ${ys[i + 1].toFixed(1)}`;
  }
  return d;
}

/**
 * Apple-style series chart: no grid, no y-axis — one smooth line (or rounded bars) with a soft wash,
 * a quiet guide line for a target pace, and only the first/last dates underneath. The parent owns
 * the readout; this reports the scrubbed index through `onHover` so the readout can follow it.
 */
export function SmoothLineChart({
  values,
  color,
  hover,
  onHover,
  reduce,
  ariaLabel,
  startLabel,
  endLabel,
  guide,
  variant = "line",
  /** Points beyond this index are in the future: the line stops there, the axis keeps going. */
  lastIndex,
  muted,
}: {
  values: (number | null)[];
  color: string;
  hover: number | null;
  onHover: (i: number | null) => void;
  reduce: boolean;
  ariaLabel: string;
  startLabel: string;
  endLabel: string;
  guide?: (number | null)[] | number | null;
  variant?: "line" | "bars";
  lastIndex?: number;
  /** Bars drawn faded (e.g. a day that fell short of its share). */
  muted?: boolean[];
}) {
  const gradId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 180 });
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.max(140, Math.round(e.contentRect.height)) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = values.length;
  const end = lastIndex ?? n - 1;
  const m = useMemo(() => {
    const { w, h } = size;
    if (w === 0 || n === 0) return null;
    const floor = h - PAD_BOTTOM;
    const guideVals = Array.isArray(guide) ? guide : guide != null ? values.map(() => guide) : [];
    const max = Math.max(1, ...values.map((v) => v ?? 0), ...guideVals.map((v) => v ?? 0)) * 1.12;
    const x = (i: number) => (n === 1 ? w / 2 : (i / (n - 1)) * w);
    const y = (v: number) => floor - (v / max) * (floor - PAD_TOP);
    const shown = values.slice(0, end + 1).map((v) => v ?? 0);
    const xs = shown.map((_, i) => x(i));
    const ys = shown.map((v) => y(v));
    const line = smoothPath(xs, ys, floor);
    const area = xs.length ? `${line} L${xs[xs.length - 1]} ${floor} L${xs[0]} ${floor} Z` : "";
    const guidePath = guideVals.length
      ? guideVals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v ?? 0).toFixed(1)}`).join(" ")
      : null;
    const barW = Math.max(3, Math.min(18, (w / n) * 0.55));
    return { floor, xs, ys, line, area, guidePath, x, y, barW, max };
  }, [size, values, guide, n, end]);

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    if (!m) return;
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    const i = n === 1 ? 0 : Math.round((px / size.w) * (n - 1));
    onHover(Math.max(0, Math.min(end, i)));
  }

  const hx = m && hover != null ? m.x(hover) : 0;
  const hy = m && hover != null ? m.y(values[hover] ?? 0) : 0;

  return (
    <div ref={boxRef} className="absolute inset-0">
      {m ? (
        <>
          <svg width={size.w} height={size.h} className="absolute left-0 top-0 overflow-visible" role="img" aria-label={ariaLabel}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.26 }} />
                <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
              </linearGradient>
            </defs>
            {m.guidePath && (
              <path d={m.guidePath} fill="none" strokeWidth={1.5} strokeLinecap="round" style={{ stroke: "var(--ink-3)", opacity: 0.7 }} />
            )}
            {variant === "line" ? (
              <>
                <motion.path
                  d={m.area}
                  style={{ fill: `url(#${CSS.escape(gradId)})` }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: reduce ? 0.15 : 0.6, delay: reduce ? 0 : 0.3 }}
                />
                <motion.path
                  d={m.line}
                  fill="none"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ stroke: color }}
                  initial={reduce ? { opacity: 0 } : { pathLength: 0 }}
                  animate={reduce ? { opacity: 1 } : { pathLength: 1 }}
                  transition={{ duration: reduce ? 0.15 : 0.9, ease: [0.23, 1, 0.32, 1] }}
                />
              </>
            ) : (
              values.slice(0, end + 1).map((v, i) => {
                const top = m.y(v ?? 0);
                const h = Math.max(2, m.floor - top);
                const dim = hover != null ? hover !== i : !!muted?.[i];
                return (
                  <motion.rect
                    key={i}
                    x={m.x(i) - m.barW / 2}
                    width={m.barW}
                    rx={Math.min(4, m.barW / 2)}
                    initial={reduce ? { y: top, height: h, opacity: 0 } : { y: m.floor, height: 0 }}
                    animate={{ y: top, height: h, opacity: 1 }}
                    transition={reduce ? { duration: 0.15 } : { type: "spring", duration: 0.5, bounce: 0, delay: i * 0.015 }}
                    style={{ fill: color, opacity: dim ? 0.35 : 1, transition: "opacity 150ms ease" }}
                  />
                );
              })
            )}
            {hover != null && variant === "line" && (
              <line x1={hx} x2={hx} y1={0} y2={m.floor} strokeWidth={1} style={{ stroke: "var(--ink-3)" }} />
            )}
            <rect x={0} y={0} width={size.w} height={m.floor} fill="transparent" onPointerMove={onMove} onPointerLeave={() => onHover(null)} />
          </svg>
          {variant === "line" && (
            <span
              className="pointer-events-none absolute size-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-[2.5px] ring-[var(--card)] transition-[left,top] duration-75"
              style={{
                background: color,
                left: hover != null ? hx : m.xs[m.xs.length - 1],
                top: hover != null ? hy : m.ys[m.ys.length - 1],
              }}
            />
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between text-caption font-medium text-[var(--ink-3)]">
            <span>{startLabel}</span>
            <span>{endLabel}</span>
          </div>
        </>
      ) : null}
    </div>
  );
}
