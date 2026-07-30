"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { useSafeReducedMotion } from "./useSafeReducedMotion";

export function ProblemStatement() {
  const prefersReducedMotion = useSafeReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });

  const scale = useTransform(scrollYProgress, [0.15, 0.4], [0.88, 1]);
  const opacity = useTransform(scrollYProgress, [0.1, 0.35], [0, 1]);
  const glowOpacity = useTransform(scrollYProgress, [0.1, 0.4], [0, 1]);

  return (
    <section ref={ref} className="relative py-14 sm:py-16 lg:py-20">
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <motion.div
          style={prefersReducedMotion ? { opacity: 0.7 } : { opacity: glowOpacity }}
          className="home-cta-glow h-[28rem] w-[28rem] rounded-full bg-[var(--accent-glow)] blur-3xl"
        />
      </div>
      <motion.p
        style={prefersReducedMotion ? undefined : { scale, opacity }}
        className="relative mx-auto max-w-4xl text-balance px-6 text-center text-3xl font-semibold tracking-tight text-[var(--fg)] sm:text-4xl lg:text-5xl 2xl:text-[3.25rem]"
      >
        Work happens in six different places.
        <br />
        <span className="text-[var(--muted)]">Proof happens in none of them.</span>
      </motion.p>
    </section>
  );
}
