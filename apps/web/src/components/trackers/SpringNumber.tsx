"use client";

import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "motion/react";

/**
 * Counts to `value` with a critically damped spring, starting from whatever is on screen —
 * so switching trackers mid-count re-targets smoothly instead of jumping (Animate UI "counting number").
 */
export function SpringNumber({
  value,
  format,
  className,
}: {
  value: number | null;
  format: (v: number | null) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const current = useRef<number>(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value == null) {
      el.textContent = format(null);
      return;
    }
    if (reduced) {
      current.current = value;
      el.textContent = format(value);
      return;
    }
    const controls = animate(current.current, value, {
      type: "spring",
      bounce: 0,
      duration: 0.6,
      onUpdate: (v) => {
        current.current = v;
        el.textContent = format(v);
      },
    });
    return () => controls.stop();
    // `format` is a pure formatter; re-running on identity changes would restart the count.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduced]);

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {format(value == null ? null : 0)}
    </span>
  );
}
