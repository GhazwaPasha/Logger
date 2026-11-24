"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type TreemapItem = {
  key: string;
  label: string;
  value: number;
  href?: string;
  /** Position of the department in the workspace's own order — its color follows the entity, not its rank. */
  colorIndex: number;
};

/** Four validated department hues; departments past the fourth use a neutral tile (their label carries identity). */
const HUES = ["var(--dept-1)", "var(--dept-2)", "var(--dept-3)", "var(--dept-4)"];
const TINTS = ["var(--dept-1-tint)", "var(--dept-2-tint)", "var(--dept-3-tint)", "var(--dept-4-tint)"];

type Rect = { x: number; y: number; w: number; h: number };
type Placed = TreemapItem & Rect;

/**
 * Slice-and-dice treemap in real pixels: split the (sorted) items at the point closest to half
 * their weight, cut the first time across the box's longer side, then alternate direction at each
 * level. That gives the asymmetric look — one big tile beside a column split unevenly — instead of
 * a row of thin strips.
 */
function layout(items: TreemapItem[], box: Rect, across = box.w >= box.h): Placed[] {
  if (items.length === 0) return [];
  if (items.length === 1) return [{ ...items[0], ...box }];
  const total = items.reduce((a, i) => a + i.value, 0);
  let acc = 0;
  let cut = 1;
  let best = Infinity;
  for (let i = 0; i < items.length - 1; i++) {
    acc += items[i].value;
    const miss = Math.abs(acc - total / 2);
    if (miss < best) {
      best = miss;
      cut = i + 1;
    }
  }
  const a = items.slice(0, cut);
  const b = items.slice(cut);
  const share = a.reduce((s, i) => s + i.value, 0) / total;
  if (across) {
    const w = box.w * share;
    return [...layout(a, { ...box, w }, false), ...layout(b, { x: box.x + w, y: box.y, w: box.w - w, h: box.h }, false)];
  }
  const h = box.h * share;
  return [...layout(a, { ...box, h }, true), ...layout(b, { x: box.x, y: box.y + h, w: box.w, h: box.h - h }, true)];
}

/** Half the gap between tiles: every tile is inset this much on all sides, so every gap is equal. */
const HALF_GAP = 3;
/** Area each department is drawn with at minimum, so a small one still fits its name and number. */
const MIN_SHARE = 0.2;
const AREA_PX_H = 242;

/** Softly lift tiny shares to MIN_SHARE (renormalising the rest); exact counts stay on the tiles. */
function displayValues(items: TreemapItem[]): TreemapItem[] {
  const total = items.reduce((a, i) => a + i.value, 0);
  if (total === 0) return items;
  const lifted = items.map((i) => Math.max(i.value / total, MIN_SHARE));
  const sum = lifted.reduce((a, b) => a + b, 0);
  return items.map((i, k) => ({ ...i, value: lifted[k] / sum }));
}

export function DepartmentTreemap({
  title,
  total,
  items,
  loading,
  emptyLabel,
}: {
  title: string;
  total: string;
  items: TreemapItem[];
  loading: boolean;
  emptyLabel: string;
}) {
  const live = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const none = items.filter((i) => i.value === 0);
  const sum = live.reduce((a, i) => a + i.value, 0);
  // Lay out in the area's real pixel size so tile shapes match what's on screen.
  const reduce = useReducedMotion();
  const areaRef = useRef<HTMLDivElement>(null);
  const [BOX_W, setBoxW] = useState(600);
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBoxW(Math.max(1, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const BOX_H = AREA_PX_H;
  const realValue = new Map(live.map((i) => [i.key, i.value]));
  const placed = layout(displayValues(live), { x: 0, y: 0, w: BOX_W, h: BOX_H });

  return (
    <section className="flex min-w-0 flex-col rounded-[18px] bg-[var(--card)] p-5 shadow-card">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-outfit text-base font-semibold">{title}</h2>
        <span className="text-footnote tabular-nums text-[var(--muted)]">{total}</span>
      </div>
      {none.length > 0 && live.length > 0 ? (
        <p className="mt-0.5 truncate text-footnote text-[var(--muted)]">
          {none.map((n) => n.label).join(", ")} {none.length === 1 ? "has" : "have"} nothing open
        </p>
      ) : null}

      <div ref={areaRef} className="relative -mx-[3px] -mb-[3px] mt-[13px] h-[242px]">
        {loading ? (
          <div className="absolute inset-0 animate-pulse rounded-xl bg-[var(--fill)] motion-reduce:animate-none" />
        ) : live.length === 0 ? (
          <p className="grid h-full place-items-center text-sm text-[var(--muted)]">{emptyLabel}</p>
        ) : (
          placed.map((t, i) => {
            const value = realValue.get(t.key) ?? 0;
            const hue = HUES[t.colorIndex];
            const tint = TINTS[t.colorIndex];
            const pct = Math.round((value / sum) * 100);
            const tileH = (t.h / BOX_H) * AREA_PX_H - HALF_GAP * 2;
            const compact = tileH < 84;
            const big = !compact && t.w * t.h > 900;
            const body = compact ? (
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: hue ?? "var(--ink-3)" }} />
                <span className="min-w-0 flex-1 truncate text-footnote font-semibold">{t.label}</span>
                <span className="shrink-0 text-lg font-semibold leading-none tabular-nums">{value}</span>
                <span className="shrink-0 text-xs tabular-nums text-[var(--muted)]">{pct}%</span>
              </span>
            ) : (
              <>
                <span className="flex min-w-0 items-center gap-1.5 text-footnote font-semibold">
                  <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: hue ?? "var(--ink-3)" }} />
                  <span className="truncate">{t.label}</span>
                </span>
                <span className="flex items-baseline gap-1.5">
                  <span className={cn("font-semibold leading-none tracking-tight tabular-nums", big ? "text-4xl" : "text-2xl")}>{value}</span>
                  <span className="text-footnote tabular-nums text-[var(--muted)]">{pct}%</span>
                </span>
              </>
            );
            // Exact slot (percent of the area), then the tile is inset HALF_GAP on every side.
            const slot = {
              left: `${(t.x / BOX_W) * 100}%`,
              top: `${(t.y / BOX_H) * 100}%`,
              width: `${(t.w / BOX_W) * 100}%`,
              height: `${(t.h / BOX_H) * 100}%`,
              padding: HALF_GAP,
            };
            const className = cn(
              "pressable flex size-full min-w-0 overflow-hidden rounded-xl text-left text-[var(--fg)] no-underline outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
              compact ? "items-center px-3" : "flex-col justify-between p-3",
            );
            const tile = t.href ? (
              <Link href={t.href} className={className} style={{ background: tint ?? "var(--fill-2)" }} aria-label={`${t.label}: ${value} open, ${pct}%`}>
                {body}
              </Link>
            ) : (
              <div className={className} style={{ background: tint ?? "var(--fill-2)" }}>
                {body}
              </div>
            );
            return (
              <motion.div
                key={t.key}
                className="absolute box-border"
                style={slot}
                initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(10px) scale(0.97)" }}
                animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
                transition={{ type: "spring", bounce: 0, duration: 0.5, delay: reduce ? 0 : 0.1 + i * 0.06 }}
              >
                {tile}
              </motion.div>
            );
          })
        )}
      </div>
    </section>
  );
}
