"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

/**
 * `useReducedMotion()` returns `null` during SSR (the OS preference isn't knowable on the
 * server) and resolves synchronously on the client—branching a component's DOM structure on
 * that value directly causes a hydration mismatch the moment a client actually prefers reduced
 * motion. This holds `false` (matching the server's deterministic first render) until mounted,
 * then swaps to the real value.
 */
export function useSafeReducedMotion(): boolean {
  const [mounted, setMounted] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted && !!prefersReducedMotion;
}
