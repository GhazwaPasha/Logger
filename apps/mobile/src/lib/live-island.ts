import { haptics } from '@/lib/haptics';

/**
 * A tiny store behind the floating "live island" toast (the web's `liveIsland`). Anything can call
 * `liveIsland.show(...)`; repeated calls with the same `groupKey` merge into one toast with a running count.
 */
export type IslandState = {
  id: number;
  title: string;
  description?: string;
  groupKey?: string;
  count: number;
  actionLabel?: string;
  onAction?: () => void;
};

type ShowOptions = {
  title: string;
  description?: string;
  groupKey?: string;
  /** Called with the running count when several events merge into one toast. */
  titleForCount?: (count: number) => string;
  /** How many events this call represents (default 1). */
  by?: number;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
};

const DEFAULT_DURATION_MS = 6500;

let state: IslandState | null = null;
let nextId = 1;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

function schedule(duration: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => liveIsland.dismiss(), duration);
}

export const liveIsland = {
  show(opts: ShowOptions) {
    const merging = !!opts.groupKey && state?.groupKey === opts.groupKey;
    const count = (merging ? state!.count : 0) + (opts.by ?? 1);
    state = {
      id: merging ? state!.id : nextId++,
      title: opts.titleForCount ? opts.titleForCount(count) : opts.title,
      description: opts.description,
      groupKey: opts.groupKey,
      count,
      actionLabel: opts.actionLabel,
      onAction: opts.onAction,
    };
    schedule(opts.duration ?? DEFAULT_DURATION_MS);
    haptics.success();
    emit();
  },
  dismiss() {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!state) return;
    state = null;
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: () => state,
};
