export type LiveIslandVariant = "info" | "success" | "error" | "warning";

export type LiveIslandAction = {
  label: string;
  onClick: () => void;
};

export type LiveIslandPayload = {
  id: string;
  title: string;
  description?: string;
  variant: LiveIslandVariant;
  duration: number;
  action?: LiveIslandAction;
  groupKey?: string;
  count: number;
  titleForCount?: (count: number) => string;
};

export type LiveIslandSnapshot = {
  active: LiveIslandPayload | null;
  visible: boolean;
  version: number;
};

const DEFAULT_DURATION = 6500;

let active: LiveIslandPayload | null = null;
let queue: LiveIslandPayload[] = [];
let visible = false;
let version = 0;

let dismissTimer: ReturnType<typeof setTimeout> | null = null;

const listeners = new Set<() => void>();

/** Stable reference for `useSyncExternalStore` — must not allocate on every `getSnapshot` call. */
let cachedSnapshot: LiveIslandSnapshot = {
  active: null,
  visible: false,
  version: 0,
};

export const liveIslandServerSnapshot: LiveIslandSnapshot = {
  active: null,
  visible: false,
  version: 0,
};

function emit() {
  version += 1;
  cachedSnapshot = { active, visible, version };
  for (const listener of listeners) {
    listener();
  }
}

function clearTimers() {
  if (dismissTimer) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
}

function scheduleLifecycle(item: LiveIslandPayload) {
  clearTimers();
  dismissTimer = setTimeout(() => {
    if (active?.id !== item.id) return;
    dismissActive();
  }, item.duration);
}

function presentNext() {
  const next = queue.shift();
  if (!next) {
    active = null;
    visible = false;
    emit();
    return;
  }

  active = next;
  visible = true;
  emit();
  scheduleLifecycle(next);
}

function dismissActive() {
  clearTimers();
  if (!active) return;
  visible = false;
  emit();

  dismissTimer = setTimeout(() => {
    active = null;
    emit();
    if (queue.length > 0) presentNext();
  }, 320);
}

export function subscribeLiveIsland(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLiveIslandSnapshot(): LiveIslandSnapshot {
  return cachedSnapshot;
}

export type LiveIslandShowInput = {
  title: string;
  description?: string;
  variant?: LiveIslandVariant;
  duration?: number;
  action?: LiveIslandAction;
  id?: string;
  /** When set, a new toast that shares this key with the active/queued toast merges into it (bumping `count`) instead of queuing separately. */
  groupKey?: string;
  /** Recomputes the title as coalesced toasts with the same `groupKey` merge in; called with the new total count. */
  titleForCount?: (count: number) => string;
};

function enqueue(input: LiveIslandShowInput) {
  if (input.groupKey) {
    const match = active?.groupKey === input.groupKey ? active : queue.find((i) => i.groupKey === input.groupKey);
    if (match) {
      match.count += 1;
      if (match.titleForCount) match.title = match.titleForCount(match.count);
      if (match === active) {
        emit();
        scheduleLifecycle(match);
      }
      return;
    }
  }

  const item: LiveIslandPayload = {
    id: input.id ?? `li-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: input.title,
    description: input.description,
    variant: input.variant ?? "info",
    duration: input.duration ?? DEFAULT_DURATION,
    action: input.action,
    groupKey: input.groupKey,
    count: 1,
    titleForCount: input.titleForCount,
  };

  if (!active && !visible) {
    queue = [item];
    presentNext();
    return;
  }

  queue.push(item);
}

export const liveIsland = {
  show(input: LiveIslandShowInput) {
    enqueue(input);
  },
  info(title: string, opts?: Omit<LiveIslandShowInput, "title" | "variant">) {
    enqueue({ ...opts, title, variant: "info" });
  },
  success(title: string, opts?: Omit<LiveIslandShowInput, "title" | "variant">) {
    enqueue({ ...opts, title, variant: "success" });
  },
  error(title: string, opts?: Omit<LiveIslandShowInput, "title" | "variant">) {
    enqueue({ ...opts, title, variant: "error" });
  },
  warning(title: string, opts?: Omit<LiveIslandShowInput, "title" | "variant">) {
    enqueue({ ...opts, title, variant: "warning" });
  },
  dismiss() {
    dismissActive();
  },
};
