"use client";

import { useRef, type ReactNode } from "react";
import { useScroll, type MotionValue } from "motion/react";

type ScrollPinProps = {
  /** Full-viewport steps the pinned content spans — wrapper height becomes `steps * 100vh`. */
  steps: number;
  className?: string;
  children: (progress: MotionValue<number>) => ReactNode;
};

/**
 * Tall wrapper + `sticky` viewport-height inner panel, exposing scroll progress (0→1 across the
 * wrapper's own scroll range) to children for step-driven transforms. Content stays in normal
 * document flow the whole time — no scroll-jacking, no wheel/touch interception — so keyboard
 * nav, screen readers, and mobile scroll behave exactly as they would on a static page.
 */
export function ScrollPin({ steps, className = "", children }: ScrollPinProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  return (
    <div ref={ref} className={`relative ${className}`} style={{ height: `${steps * 100}vh` }}>
      <div className="sticky top-0 h-screen overflow-hidden">{children(scrollYProgress)}</div>
    </div>
  );
}
