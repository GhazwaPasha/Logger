"use client";

import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/**
 * THE loading indicator for the workspace: one light that runs up the content sheet's left edge
 * (beside the sidebar), bends round the sheet's curved corner and carries on along the header —
 * instead of a progress strip on each panel. Anything inside the workspace that is loading or
 * saving calls {@link useEdgeLoading}; the light runs while at least one caller is active.
 */
type Ctx = { start: () => () => void };
const EdgeLoadingContext = createContext<Ctx | null>(null);

export function EdgeLoadingProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const start = useCallback(() => {
    setCount((c) => c + 1);
    let done = false;
    return () => {
      if (done) return;
      done = true;
      setCount((c) => Math.max(0, c - 1));
    };
  }, []);
  const value = useMemo(() => ({ start }), [start]);

  // Every page gets it for free: any fetch (first load or background refresh) and any save in flight.
  const fetching = useIsFetching();
  const saving = useIsMutating();
  const wanted = count > 0 || fetching > 0 || saving > 0;

  // Instant loads shouldn't flash it: appear after a beat, leave at once.
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!wanted) {
      setActive(false);
      return;
    }
    const t = window.setTimeout(() => setActive(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [wanted]);

  return (
    <EdgeLoadingContext.Provider value={value}>
      <EdgeLoadingActive.Provider value={active}>{children}</EdgeLoadingActive.Provider>
    </EdgeLoadingContext.Provider>
  );
}
const SHOW_DELAY_MS = 150;
const EdgeLoadingActive = createContext(false);

/** Run the edge light while `active`. Safe outside the workspace shell (does nothing there). */
export function useEdgeLoading(active: boolean) {
  const ctx = useContext(EdgeLoadingContext);
  useEffect(() => {
    if (!active || !ctx) return;
    return ctx.start();
  }, [active, ctx]);
}

/** Length of the travelling light (px), and how long one pass takes. */
const GLOW = 180;
const PASS_S = 1.5;
const STROKE = 2;

/**
 * Draws the light. Place it as an absolutely positioned child of the curved sheet; it measures the
 * sheet and its corner radius, so the path hugs the real edge at any size (on phones, where the sheet
 * has no curve or sidebar, the light just runs along the top).
 */
export function EdgeLoader() {
  const active = useContext(EdgeLoadingActive);
  const reduce = useReducedMotion();
  const ref = useRef<SVGSVGElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0, r: 0 });

  useEffect(() => {
    const host = ref.current?.parentElement;
    if (!host) return;
    const measure = () => {
      const r = parseFloat(getComputedStyle(host).borderTopLeftRadius) || 0;
      setBox({ w: host.clientWidth, h: host.clientHeight, r });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  // Half the stroke in from the edge so the sheet's overflow clip doesn't cut it in half.
  const o = STROKE / 2;
  const { w, h, r } = box;
  const curved = r > 0;
  const rr = Math.max(0, r - o);
  const d = curved
    ? `M${o} ${h} L${o} ${o + rr} A${rr} ${rr} 0 0 1 ${o + rr} ${o} L${w} ${o}`
    : `M0 ${o} L${w} ${o}`;
  const length = curved ? h - o - rr + (Math.PI * rr) / 2 + (w - o - rr) : w;

  return (
    <svg
      ref={ref}
      className="pointer-events-none absolute inset-0 z-[60] overflow-visible"
      width={w}
      height={h}
      aria-hidden
    >
      <AnimatePresence>
        {active && w > 0 && (
          <motion.g
            key="light"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.15 : 0.3 }}
          >
            {reduce ? (
              // Reduced motion: no travel — the whole edge breathes softly instead.
              <motion.path
                d={d}
                fill="none"
                strokeWidth={STROKE}
                strokeLinecap="round"
                style={{ stroke: "var(--ink-3)" }}
                initial={{ opacity: 0.25 }}
                animate={{ opacity: [0.25, 0.6, 0.25] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
            ) : (
              // One plain line, no glow: the dash starts just before the path's start (bottom-left) and runs off its end.
              <motion.path
                d={d}
                fill="none"
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={`${GLOW} ${length + GLOW}`}
                style={{ stroke: "var(--ink-3)" }}
                initial={{ strokeDashoffset: GLOW }}
                animate={{ strokeDashoffset: -length }}
                transition={{ duration: PASS_S, repeat: Infinity, ease: [0.45, 0, 0.25, 1] }}
              />
            )}
          </motion.g>
        )}
      </AnimatePresence>
    </svg>
  );
}
