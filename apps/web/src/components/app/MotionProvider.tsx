"use client";

import { AnimateUIProvider } from "@animate-ui/react/provider";

/**
 * animate-ui drives every primitive's motion. Kept behind our own client boundary: mounting the
 * library provider directly in the server root layout made every route except `/` render
 * not-found in dev.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <AnimateUIProvider reducedMotion="user" checkAnimation="draw">
      {children}
    </AnimateUIProvider>
  );
}
