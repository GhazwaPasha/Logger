"use client";

import Link from "next/link";
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import { useEffect, useRef, useState } from "react";

export type RingSegment = { key: string; label: string; value: number; color: string; href?: string };
type Half = "top" | "bottom";
type Focus = { half: Half; key: string } | null;

/** Arc thickness (viewBox units). */
const STROKE = 10;
/** Degrees between neighbouring pieces. */
const GAP_DEG = 4;
/** Half a gap each side of the 3 and 9 o'clock seams, so the seam reads like any other gap. */
const SEAM_DEG = GAP_DEG / 2;
/** How long a half takes to fill, piece by piece (seconds). */
const FILL_S = 0.9;
const R = 84;

/** Smallest slice of a half a non-zero segment is drawn with, so tiny counts stay visible. */
const MIN_SHARE = 0.07;
/** < 1 compresses the gap between big and small counts (1 would be exact proportions). */
const SHARE_EXPONENT = 0.6;

/**
 * How much of its half each segment is drawn with. Softened (raised to SHARE_EXPONENT) so a dominant count
 * doesn't swallow the ring, and every non-zero segment gets at least MIN_SHARE. Exact values live in the legend.
 */
function displayShares(segments: RingSegment[]): number[] {
  const total = segments.reduce((n, s) => n + s.value, 0);
  if (total === 0) return segments.map(() => 0);
  const soft = segments.map((s) => (s.value > 0 ? Math.pow(s.value / total, SHARE_EXPONENT) : 0));
  const softTotal = soft.reduce((a, b) => a + b, 0);
  const shares = soft.map((w) => w / softTotal);
  const lifted: number[] = shares.map((x) => (x > 0 && x < MIN_SHARE ? MIN_SHARE : 0));
  const liftedTotal = lifted.reduce((a, b) => a + b, 0);
  const restTotal = shares.reduce((n, x, i) => n + (lifted[i] ? 0 : x), 0);
  if (liftedTotal === 0 || restTotal === 0) return shares;
  return shares.map((x, i) => (lifted[i] ? lifted[i] : (x / restTotal) * (1 - liftedTotal)));
}

/** Where each segment sits along its half, as fractions 0 → 1 in fill order. */
function spans(segments: RingSegment[]) {
  const shares = displayShares(segments);
  const out: { seg: RingSegment; from: number; to: number }[] = [];
  let at = 0;
  segments.forEach((seg, i) => {
    if (shares[i] <= 0) return;
    out.push({ seg, from: at, to: at + shares[i] });
    at += shares[i];
  });
  return out;
}

const point = (deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return { x: 100 + R * Math.cos(rad), y: 100 + R * Math.sin(rad) };
};
const fmt = (deg: number) => {
  const p = point(deg);
  return `${p.x.toFixed(3)} ${p.y.toFixed(3)}`;
};

/** SVG arc between two angles (degrees, clockwise from 3 o'clock). */
function arcPath(fromDeg: number, toDeg: number) {
  const [a, b] = fromDeg < toDeg ? [fromDeg, toDeg] : [toDeg, fromDeg];
  return `M ${fmt(a)} A ${R} ${R} 0 0 1 ${fmt(b)}`;
}

/** SVG arc drawn from `fromDeg` towards `toDeg` (either way round), so a dash reveals it in that direction. */
function directedArc(fromDeg: number, toDeg: number) {
  return `M ${fmt(fromDeg)} A ${R} ${R} 0 0 ${toDeg > fromDeg ? 1 : 0} ${fmt(toDeg)}`;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** One coloured piece of the ring. Geometry is fixed; only the dash offset follows `filled`. */
function FillArc({
  filled,
  from,
  to,
  fromDeg,
  toDeg,
  color,
  startCap,
  endCap,
}: {
  filled: MotionValue<number>;
  from: number;
  to: number;
  fromDeg: number;
  toDeg: number;
  color: string;
  startCap: boolean;
  endCap: boolean;
}) {
  const length = (Math.abs(toDeg - fromDeg) * Math.PI * R) / 180;
  const offset = useTransform(filled, (v) => length * (1 - clamp01((v - from) / (to - from))));
  const startOpacity = useTransform(filled, (v) => (v > from ? 1 : 0));
  const endOpacity = useTransform(filled, (v) => (v >= to - 1e-4 ? 1 : 0));
  const s = point(fromDeg);
  const e = point(toDeg);
  return (
    <>
      <motion.path
        d={directedArc(fromDeg, toDeg)}
        stroke={color}
        strokeWidth={STROKE}
        fill="none"
        strokeDasharray={`${length} ${length + 1}`}
        style={{ strokeDashoffset: offset }}
      />
      {startCap ? <motion.circle cx={s.x} cy={s.y} r={STROKE / 2} fill={color} style={{ opacity: startOpacity }} /> : null}
      {endCap ? <motion.circle cx={e.x} cy={e.y} r={STROKE / 2} fill={color} style={{ opacity: endOpacity }} /> : null}
    </>
  );
}

/**
 * The segmented ring: one rounded piece per colour, sized by its share. Both halves fill left → right — status
 * over the top, priority under the bottom. With a `focus`, every other piece dims. The fill plays once, when the numbers first land; later changes
 * just redraw it full.
 */
function TickRing({
  top,
  bottom,
  focus,
  ready,
  fillDelay,
}: {
  top: RingSegment[];
  bottom: RingSegment[];
  focus: Focus;
  ready: boolean;
  fillDelay: number;
}) {
  const filled = useMotionValue(0);
  const reduced = useReducedMotion();
  const hasFilled = useRef(false);
  const signature = [...top, ...bottom].map((s) => s.value).join(",");

  useEffect(() => {
    if (!ready) {
      filled.set(0);
      return;
    }
    if (hasFilled.current || reduced) {
      hasFilled.current = true;
      filled.set(1);
      return;
    }
    hasFilled.current = true;
    filled.set(0);
    const controls = animate(filled, 1, { duration: FILL_S, delay: fillDelay, ease: [0.33, 1, 0.68, 1] });
    return () => controls.stop();
  }, [signature, ready, fillDelay, filled, reduced]);

  const span = 180 - SEAM_DEG * 2;
  // Round caps reach past an arc's ends; pull each piece in by that much so the gaps stay even.
  const capDeg = (STROKE / 2 / R) * (180 / Math.PI);
  const halves: { half: Half; segments: RingSegment[]; dir: 1 | -1 }[] = [
    { half: "top", segments: top, dir: 1 },
    { half: "bottom", segments: bottom, dir: -1 },
  ];
  const track = (key: string, a: number, b: number) => (
    <path
      key={key}
      d={arcPath(a, b)}
      className="stroke-[color:var(--fg)]"
      strokeOpacity={0.08}
      strokeWidth={STROKE}
      strokeLinecap="round"
      fill="none"
    />
  );

  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden>
      {halves.map(({ half, segments, dir }) => {
        const at = (deg: number) => 180 + dir * deg;
        const pieces = spans(segments);
        // Nothing to show yet: one empty track across the half.
        if (pieces.length === 0) return track(`${half}-empty`, at(SEAM_DEG + capDeg), at(SEAM_DEG + span - capDeg));
        // Each segment is its own piece, as long as its share; the gaps sit only between colours.
        const room = span - GAP_DEG * (pieces.length - 1);
        return pieces.map((p, i) => {
          const start = SEAM_DEG + p.from * room + i * GAP_DEG;
          const end = start + (p.to - p.from) * room;
          const c0 = start + capDeg;
          // A sliver too short for its caps is drawn as a dot rather than flipping round.
          const c1 = Math.max(c0 + 0.01, end - capDeg);
          const dimmed = focus !== null && !(focus.half === half && focus.key === p.seg.key);
          return (
            <g key={`${half}-${p.seg.key}`}>
              {track("track", at(c0), at(c1))}
              <g opacity={dimmed ? 0.16 : 1} className="transition-opacity duration-200">
                <FillArc
                  filled={filled}
                  from={p.from}
                  to={p.to}
                  fromDeg={at(c0)}
                  toDeg={at(c1)}
                  color={p.seg.color}
                  startCap
                  endCap
                />
              </g>
            </g>
          );
        });
      })}
    </svg>
  );
}

const sum = (segments: RingSegment[]) => segments.reduce((n, s) => n + s.value, 0);
const pct = (value: number, total: number) => (total ? Math.round((value / total) * 100) : 0);

/**
 * Dashboard hero: one big segmented ring — status mix across the top, priority across the bottom — with its legend
 * alongside. Hovering (or clicking) a legend row highlights that segment's piece and puts its number in the centre.
 */
export function StatusPriorityRing({
  top,
  bottom,
  topTitle,
  bottomTitle,
  topLabel,
  bottomLabel,
  loading,
  fillDelay = 0,
}: {
  top: RingSegment[];
  bottom: RingSegment[];
  topTitle: string;
  bottomTitle: string;
  topLabel: string;
  bottomLabel: string;
  loading: boolean;
  /** Seconds after mount before the fill starts, so it plays once the panel's entrance has landed. */
  fillDelay?: number;
}) {
  const [hover, setHover] = useState<Focus>(null);
  const [pinned, setPinned] = useState<Focus>(null);
  const focus = hover ?? pinned;
  const focused = focus ? (focus.half === "top" ? top : bottom).find((s) => s.key === focus.key) : undefined;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-center lg:gap-8">
      <div
        className="relative aspect-square w-full max-w-[17rem] shrink-0"
        role="img"
        aria-label={`${topTitle}: ${sum(top)} ${topLabel}. ${bottomTitle}: ${sum(bottom)} ${bottomLabel}.`}
      >
        <TickRing top={top} bottom={bottom} focus={focus} ready={!loading} fillDelay={fillDelay} />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {loading ? (
            <span className="h-8 w-14 animate-pulse rounded-lg bg-[var(--surface-muted)] motion-reduce:animate-none" />
          ) : focus && focused ? (
            <>
              <span className="mb-1 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: focused.color }} />
              <span className="text-[2.6rem] font-bold leading-none tracking-tight tabular-nums">{focused.value}</span>
              <span className="mt-1 text-sm font-medium">{focused.label}</span>
              <span className="text-xs tabular-nums text-[var(--muted)]">
                {pct(focused.value, sum(focus.half === "top" ? top : bottom))}% of{" "}
                {focus.half === "top" ? topLabel : bottomLabel}
              </span>
            </>
          ) : (
            <>
              <span className="text-[2.1rem] font-bold leading-none tracking-tight tabular-nums">{sum(top)}</span>
              <span className="mt-1 text-[11px] uppercase tracking-wider text-[var(--muted)]">{topLabel}</span>
              <span className="my-2 h-px w-[30%] bg-[var(--border-subtle)]" />
              <span className="text-[2.1rem] font-bold leading-none tracking-tight tabular-nums">{sum(bottom)}</span>
              <span className="mt-1 text-[11px] uppercase tracking-wider text-[var(--muted)]">{bottomLabel}</span>
            </>
          )}
        </div>
      </div>

      <div className="w-full min-w-0 max-w-[18rem] space-y-3" onMouseLeave={() => setHover(null)}>
        <LegendGroup
          title={topTitle}
          half="top"
          segments={top}
          focus={focus}
          loading={loading}
          onHover={setHover}
          onPin={setPinned}
        />
        <div className="mx-2.5 h-px bg-[var(--border-subtle)]" />
        <LegendGroup
          title={bottomTitle}
          half="bottom"
          segments={bottom}
          focus={focus}
          loading={loading}
          onHover={setHover}
          onPin={setPinned}
        />
      </div>
    </div>
  );
}

function LegendGroup({
  title,
  half,
  segments,
  focus,
  loading,
  onHover,
  onPin,
}: {
  title: string;
  half: Half;
  segments: RingSegment[];
  focus: Focus;
  loading: boolean;
  onHover: (f: Focus) => void;
  onPin: (update: (f: Focus) => Focus) => void;
}) {
  const total = sum(segments);
  return (
    <div>
      <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        {half === "top" ? "▲" : "▼"} {title}
      </p>
      <ul>
        {segments.map((s) => {
          const active = focus?.half === half && focus.key === s.key;
          const row = (
            <>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
              <span className={`min-w-0 flex-1 truncate text-sm ${active ? "font-semibold" : "font-medium"}`}>
                {s.label}
              </span>
              <span className="w-10 text-right text-xs tabular-nums text-[var(--muted)]">
                {loading ? "" : `${pct(s.value, total)}%`}
              </span>
              <span className="min-w-[2.25rem] text-right text-sm font-semibold tabular-nums">{loading ? "…" : s.value}</span>
            </>
          );
          const className =
            "flex min-h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-left no-underline transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";
          const style = active ? { backgroundColor: `color-mix(in srgb, ${s.color} 16%, transparent)` } : undefined;
          const handlers = {
            onMouseEnter: () => onHover({ half, key: s.key }),
            onFocus: () => onHover({ half, key: s.key }),
            onBlur: () => onHover(null),
          };
          return (
            <li key={s.key}>
              {s.href ? (
                <Link href={s.href} className={className} style={style} {...handlers}>
                  {row}
                </Link>
              ) : (
                <button
                  type="button"
                  className={className}
                  style={style}
                  aria-pressed={active}
                  onClick={() => onPin((f) => (f?.half === half && f.key === s.key ? null : { half, key: s.key }))}
                  {...handlers}
                >
                  {row}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
