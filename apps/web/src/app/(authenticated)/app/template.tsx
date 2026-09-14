"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { POP_EASE, motionDuration } from "@/components/ui/motion-presets";

export default function AppEntryTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prefersReduced = useReducedMotion();
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: prefersReduced ? 0 : 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: prefersReduced ? 0 : -6 }}
        transition={{ duration: motionDuration(0.22, prefersReduced), ease: POP_EASE }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
