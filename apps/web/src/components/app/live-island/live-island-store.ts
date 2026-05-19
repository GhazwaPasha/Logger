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
};

export type LiveIslandSnapshot = {
  active: LiveIslandPayload | null;
  expanded: boolean;
  visible: boolean;
  version: number;
};

const DEFAULT_DURATION = 6500;

let active: LiveIslandPayload | null = null;
let queue: LiveIslandPayload[] = [];
let expanded = false;
let visible = false;
let version = 0;

let dismissTimer: ReturnType<typeof setTimeout> | null = null;
let compactTimer: ReturnType<typeof setTimeout> | null = null;

const listeners = new Set<() => void>();

/** Stable reference for `useSyncExternalStore` — must not allocate on every `getSnapshot` call. */
let cachedSnapshot: LiveIslandSnapshot = {
  active: null,
  expanded: false,
  visible: false,
  version: 0,
};

export const liveIslandServerSnapshot: LiveIslandSnapshot = {
  active: null,
  expanded: false,
  visible: false,
  version: 0,
};

function emit() {
  version += 1;
  cachedSnapshot = { active, expanded, visible, version };
  for (const listener of listeners) {
    listener();
  }
}

function clearTimers() {
  if (dismissTimer) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
  if (compactTimer) {
    clearTimeout(compactTimer);
    compactTimer = null;
  }
}

function scheduleLifecycle(item: LiveIslandPayload) {
  clearTimers();
  const compactAfter = Math.min(4200, Math.max(1800, item.duration - 2200));

  compactTimer = setTimeout(() => {
    if (active?.id !== item.id) return;
    expanded = false;
    emit();
  }, compactAfter);

  dismissTimer = setTimeout(() => {
    if (active?.id !== item.id) return;
    dismissActive();
  }, item.duration);
}

function presentNext() {
  const next = queue.shift();
  if (!next) {
    active = null;
    expanded = false;
    visible = false;
    emit();
    return;
  }

  active = next;
  expanded = true;
  visible = true;
  emit();
  scheduleLifecycle(next);
}

function dismissActive() {
  clearTimers();
  if (!active) return;
  visible = false;
  expanded = false;
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
};

function enqueue(input: LiveIslandShowInput) {
  const item: LiveIslandPayload = {
    id: input.id ?? `li-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: input.title,
    description: input.description,
    variant: input.variant ?? "info",
    duration: input.duration ?? DEFAULT_DURATION,
    action: input.action,
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
  expand() {
    if (!active) return;
    expanded = true;
    emit();
    if (active) scheduleLifecycle(active);
  },
  compact() {
    if (!active) return;
    expanded = false;
    emit();
  },
};
