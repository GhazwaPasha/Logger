"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Avatar } from "@/components/ui/Avatar";

export type BubbleItem = {
  key: string;
  label: string;
  value: number;
  href?: string;
  avatar: { name?: string | null; email?: string | null; image?: string | null };
};

const HUES = ["var(--dept-1)", "var(--dept-2)", "var(--dept-3)", "var(--dept-4)"];
const TINTS = ["var(--dept-1-tint)", "var(--dept-2-tint)", "var(--dept-3-tint)", "var(--dept-4-tint)"];

/** A person's color comes from their id, so it never changes when the ranking does. */
function hueIndex(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % HUES.length;
}

/** Hand-placed slots (centre %, largest first) — reads as a loose cluster, never overlaps for ≤ 6. */
const SLOTS: Record<number, { x: number; y: number }[]> = {
  1: [{ x: 50, y: 50 }],
  2: [{ x: 38, y: 50 }, { x: 70, y: 50 }],
  3: [{ x: 34, y: 50 }, { x: 66, y: 32 }, { x: 70, y: 74 }],
  4: [{ x: 32, y: 50 }, { x: 62, y: 30 }, { x: 64, y: 74 }, { x: 87, y: 52 }],
  5: [{ x: 28, y: 50 }, { x: 56, y: 28 }, { x: 58, y: 74 }, { x: 82, y: 36 }, { x: 84, y: 76 }],
  6: [{ x: 24, y: 50 }, { x: 50, y: 26 }, { x: 52, y: 74 }, { x: 74, y: 40 }, { x: 90, y: 22 }, { x: 88, y: 76 }],
};

/** Assignee load: bubble area = open tasks. Each bubble links to that person's tasks. */
export function AssigneeBubbles({
  title,
  total,
  items,
  loading,
  emptyLabel,
}: {
  title: string;
  total: string;
  items: BubbleItem[];
  loading: boolean;
  emptyLabel: string;
}) {
  const reduce = useReducedMotion();
  const shown = items.filter((i) => i.value > 0).slice(0, 6);
  const max = Math.max(1, ...shown.map((i) => i.value));
  const slots = SLOTS[shown.length] ?? [];

  return (
    <section className="flex min-w-0 flex-col rounded-[18px] bg-[var(--card)] p-5 shadow-card">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-outfit text-base font-semibold">{title}</h2>
        <span className="text-xs text-[var(--muted)]">{total}</span>
      </div>
      <p className="mt-0.5 text-xs text-[var(--muted)]">Bubble size shows how much each person has open</p>

      <div className="relative mt-4 h-[236px]">
        {loading ? (
          <div className="absolute inset-0 animate-pulse rounded-xl bg-[var(--fill)] motion-reduce:animate-none" />
        ) : shown.length === 0 ? (
          <p className="grid h-full place-items-center text-sm text-[var(--muted)]">{emptyLabel}</p>
        ) : (
          shown.map((p, i) => {
            // Area ∝ value: diameter ∝ √value, between 64px and 168px.
            const size = Math.round(64 + Math.sqrt(p.value / max) * 104);
            const k = hueIndex(p.key);
            const firstName = p.label.split(/\s+/)[0];
            const body = (
              <>
                {size >= 96 ? <Avatar name={p.avatar.name} email={p.avatar.email} image={p.avatar.image} size="size-6" /> : null}
                <span className="font-semibold leading-none tracking-tight tabular-nums" style={{ fontSize: Math.round(14 + size / 9) }}>
                  {p.value}
                </span>
                <span className="max-w-[90%] truncate text-caption text-[var(--muted)]">{firstName}</span>
              </>
            );
            const style = { background: TINTS[k], boxShadow: `inset 0 0 0 1.5px ${HUES[k]}` };
            const className =
              "pressable flex size-full flex-col items-center justify-center gap-1 rounded-full text-[var(--fg)] no-underline outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";
            return (
              // Outer wrapper places + pops the bubble; the inner link keeps its own press scale.
              <motion.div
                key={p.key}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${slots[i].x}%`, top: `${slots[i].y}%`, width: size, height: size }}
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", bounce: 0.3, duration: 0.55, delay: reduce ? 0 : 0.12 + i * 0.07 }}
              >
                {p.href ? (
                  <Link href={p.href} className={className} style={style} aria-label={`${p.label}: ${p.value} open`}>
                    {body}
                  </Link>
                ) : (
                  <div className={className} style={style}>
                    {body}
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>
    </section>
  );
}
