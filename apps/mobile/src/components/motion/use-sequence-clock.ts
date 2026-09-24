import { useCallback, useEffect, useRef } from 'react';

/**
 * For animations timed against a mount-relative schedule: returns `delayUntil(at)`, the ms still to wait
 * until `at` ms after this component mounted (0 once that moment has passed). Lets an animation that is
 * restarted later (new data) start straight away, while the first run still waits for its slot.
 *
 * Call it from an effect declared after this hook: the mount time is stamped in this hook's own effect,
 * which runs first.
 */
export function useSequenceClock() {
  const mountedAt = useRef(0);
  useEffect(() => {
    if (!mountedAt.current) mountedAt.current = Date.now();
  }, []);
  return useCallback((at: number) => Math.max(0, at - (Date.now() - mountedAt.current)), []);
}
