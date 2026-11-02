"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  formatZonedDateKey,
  type AgentMessage,
  type AgentThreadDetail,
  type AgentThreadSummary,
} from "@work-ledger/contracts";
import { LogBaseMark } from "@/components/brand/LogBaseMark";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { POP_EASE } from "@/components/ui/motion-presets";
import { useIsMobile } from "@/hooks/useIsMobile";
import { ApiError, apiJson, apiVoid } from "@/lib/api";
import { agentKeys, streamAsk } from "@/lib/agent";
import { AgentText } from "./AgentText";

type OpenAskOptions = { prompt?: string; taskId?: string; send?: boolean };

type ChatMessage = Pick<AgentMessage, "id" | "role" | "content" | "steps">;
type SearchHit = { id: string; title: string; status: string };

type AskState = {
  open: boolean;
  view: "chat" | "history";
  threadId: string | null;
  title: string | null;
  taskId: string | null;
  messages: ChatMessage[];
  /** Live run: tool steps so far and the answer text streamed so far. */
  liveSteps: string[];
  draft: string;
  running: boolean;
  error: { message: string; retry: string | null } | null;
};

type AskContextValue = AskState & {
  openAsk: (opts?: OpenAskOptions) => void;
  toggleAsk: () => void;
  close: () => void;
  setView: (v: "chat" | "history") => void;
  newChat: () => void;
  loadThread: (id: string) => Promise<void>;
  send: (text: string, opts?: { taskId?: string | null; fresh?: boolean; retry?: boolean }) => Promise<void>;
  stop: () => void;
  forgetThread: (id: string) => void;
};

const AskContext = createContext<AskContextValue | null>(null);
/** The pane's text box, kept apart from the state context so reading that context never counts as reading a ref. */
const AskInputContext = createContext<RefObject<HTMLTextAreaElement | null> | null>(null);

/** Null outside a workspace (the header also renders on `/app`), so callers can hide their entry point. */
export function useAsk(): AskContextValue | null {
  return useContext(AskContext);
}

const SUGGESTIONS = ["What's overdue right now?", "What's due for me this week?", "What changed today?"];
const TASK_SUGGESTIONS = ["Summarize this task", "What's still left to do?", "Who changed what recently?"];

const WIDTH_KEY = "logbase.askPaneWidth";
const DEFAULT_WIDTH = 400;
const MIN_WIDTH = 320;
const MAX_WIDTH = 720;

const EMPTY: AskState = {
  open: false,
  view: "chat",
  threadId: null,
  title: null,
  taskId: null,
  messages: [],
  liveSteps: [],
  draft: "",
  running: false,
  error: null,
};

/**
 * Owns the Ask LogBase conversation. The pane itself is rendered by the workspace shell next to `<main>`
 * (see {@link AskPane}), so it docks beside the app instead of covering it.
 */
export function AskProvider({ children }: { children: ReactNode }) {
  const { workspaceId } = useWorkspaceRoute();
  const queryClient = useQueryClient();
  const [state, setState] = useState<AskState>(EMPTY);
  // Callbacks read the latest state through this ref so their identities stay stable across streaming updates.
  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  });
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const patch = useCallback((p: Partial<AskState>) => setState((s) => ({ ...s, ...p })), []);
  const focusInput = useCallback(() => setTimeout(() => inputRef.current?.focus(), 60), []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState((s) => ({ ...s, running: false, liveSteps: [], draft: "" }));
  }, []);

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState((s) => ({ ...EMPTY, open: s.open }));
    focusInput();
  }, [focusInput]);

  const send = useCallback<AskContextValue["send"]>(
    async (text, opts) => {
      const message = text.trim();
      const s = stateRef.current;
      if (!message || s.running) return;
      // Retrying: the failed question is already on screen, so it isn't added a second time.
      const isRetry = !!opts?.retry && s.messages.at(-1)?.role === "user" && s.messages.at(-1)?.content === message;
      // `fresh`: the caller just reset the conversation, so the current `threadId` is stale.
      const threadId = opts?.fresh ? null : s.threadId;
      const taskId = threadId ? undefined : (opts?.taskId ?? s.taskId ?? undefined);

      setState((prev) => ({
        ...prev,
        view: "chat",
        running: true,
        error: null,
        liveSteps: [],
        draft: "",
        messages: isRetry
          ? prev.messages
          : [...prev.messages, { id: `local-${Date.now()}`, role: "user", content: message, steps: null }],
      }));

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const steps: string[] = [];
      try {
        await streamAsk(
          workspaceId,
          { message, threadId: threadId ?? undefined, taskId },
          (e) => {
            if (ctrl.signal.aborted) return;
            if (e.type === "thread") {
              patch({ threadId: e.threadId, title: e.title });
            } else if (e.type === "step") {
              steps.push(e.label);
              // A step after streamed text means that text was a preamble to more lookups: drop it.
              setState((prev) => ({ ...prev, liveSteps: [...steps], draft: "" }));
            } else if (e.type === "delta") {
              setState((prev) => ({ ...prev, draft: prev.draft + e.text }));
            } else if (e.type === "answer") {
              setState((prev) => ({
                ...prev,
                title: e.title,
                draft: "",
                messages: [...prev.messages, { id: e.messageId, role: "assistant", content: e.text, steps: steps.map((label) => ({ label })) }],
              }));
            } else if (e.type === "error") {
              patch({ error: { message: e.message, retry: message } });
            }
          },
          ctrl.signal,
        );
      } catch (err) {
        if (!ctrl.signal.aborted) {
          patch({ error: { message: err instanceof ApiError || err instanceof Error ? err.message : "Something went wrong.", retry: message } });
        }
      } finally {
        if (abortRef.current === ctrl) {
          abortRef.current = null;
          setState((prev) => ({ ...prev, running: false, liveSteps: [], draft: "" }));
        }
        void queryClient.invalidateQueries({ queryKey: agentKeys.threads(workspaceId) });
      }
    },
    [workspaceId, queryClient, patch],
  );

  const openAsk = useCallback<AskContextValue["openAsk"]>(
    (opts) => {
      const s = stateRef.current;
      const switchingTask = !!opts?.taskId && opts.taskId !== s.taskId;
      if (switchingTask) {
        abortRef.current?.abort();
        abortRef.current = null;
        setState({ ...EMPTY, open: true, taskId: opts!.taskId! });
      } else {
        patch({ open: true, view: "chat" });
      }
      if (opts?.prompt && opts.send) void send(opts.prompt, { taskId: opts.taskId, fresh: switchingTask });
      focusInput();
    },
    [patch, send, focusInput],
  );

  const close = useCallback(() => patch({ open: false }), [patch]);

  const toggleAsk = useCallback(() => {
    if (stateRef.current.open) close();
    else {
      patch({ open: true });
      focusInput();
    }
  }, [close, patch, focusInput]);

  const loadThread = useCallback(
    async (id: string) => {
      abortRef.current?.abort();
      abortRef.current = null;
      setState((s) => ({ ...EMPTY, open: s.open }));
      try {
        const detail = await queryClient.fetchQuery({
          queryKey: agentKeys.thread(id),
          queryFn: () => apiJson<AgentThreadDetail>(`/agent/threads/${id}`),
          staleTime: 0,
        });
        patch({ threadId: detail.id, title: detail.title, taskId: detail.taskId, messages: detail.messages });
      } catch {
        patch({ error: { message: "Couldn't open that conversation.", retry: null } });
      }
      focusInput();
    },
    [queryClient, patch, focusInput],
  );

  const forgetThread = useCallback(
    (id: string) => {
      if (stateRef.current.threadId === id) newChat();
    },
    [newChat],
  );

  // ⌘K / Ctrl+K: open and focus; pressed again while typing in the pane, close it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) return;
      e.preventDefault();
      const inPane = document.activeElement?.closest("[data-ask-pane]");
      if (stateRef.current.open && inPane) close();
      else {
        patch({ open: true });
        focusInput();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close, patch, focusInput]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const value = useMemo<AskContextValue>(
    () => ({
      ...state,
      openAsk,
      toggleAsk,
      close,
      setView: (view) => patch({ view }),
      newChat,
      loadThread,
      send,
      stop,
      forgetThread,
    }),
    [state, openAsk, toggleAsk, close, patch, newChat, loadThread, send, stop, forgetThread],
  );

  return (
    <AskContext.Provider value={value}>
      <AskInputContext.Provider value={inputRef}>{children}</AskInputContext.Provider>
    </AskContext.Provider>
  );
}

function readStoredWidth(): number {
  try {
    const n = Number(localStorage.getItem(WIDTH_KEY));
    return Number.isFinite(n) && n >= MIN_WIDTH ? n : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

function clampWidth(w: number): number {
  const max = typeof window === "undefined" ? MAX_WIDTH : Math.min(MAX_WIDTH, Math.round(window.innerWidth * 0.6));
  return Math.round(Math.min(Math.max(w, MIN_WIDTH), Math.max(MIN_WIDTH, max)));
}

/**
 * The docked side section: sits in the shell's row after `<main>`, which shrinks to make room — like the
 * browser / terminal panes in Claude's desktop app. Drag (or arrow-key) its left edge to resize; the width is
 * remembered per browser. Below `md` there's no room to dock, so it takes the screen instead.
 */
export function AskPane() {
  const ask = useAsk();
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();
  // The pane only renders after a click or ⌘K, never on the server, so reading storage here can't mismatch.
  const [width, setWidth] = useState(() => (typeof window === "undefined" ? DEFAULT_WIDTH : clampWidth(readStoredWidth())));
  const [dragging, setDragging] = useState(false);

  const saveWidth = (w: number) => {
    try {
      localStorage.setItem(WIDTH_KEY, String(w));
    } catch {
      /* per-browser convenience only */
    }
  };

  const onResizeStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onResizeMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setWidth(clampWidth(window.innerWidth - e.clientX));
  };
  const onResizeEnd = () => {
    if (!dragging) return;
    setDragging(false);
    saveWidth(width);
  };
  const onResizeKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 64 : 16;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const next = clampWidth(width + (e.key === "ArrowLeft" ? step : -step));
      setWidth(next);
      saveWidth(next);
    }
  };

  if (!ask) return null;

  if (isMobile) {
    return (
      <AnimatePresence>
        {ask.open && (
          <motion.aside
            key="ask-mobile"
            data-ask-pane
            aria-label="Ask LogBase"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: reduceMotion ? 0 : 0.18, ease: POP_EASE }}
            className="fixed inset-x-0 bottom-0 top-14 z-[45] flex flex-col bg-[var(--surface-base)]"
          >
            <AskChrome compact />
          </motion.aside>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence initial={false}>
      {ask.open && (
        <motion.aside
          key="ask-docked"
          data-ask-pane
          aria-label="Ask LogBase"
          initial={{ width: 0 }}
          animate={{ width }}
          exit={{ width: 0 }}
          transition={{ duration: dragging || reduceMotion ? 0 : 0.22, ease: POP_EASE }}
          className="relative h-full shrink-0 overflow-hidden border-l border-[var(--border-subtle)] bg-[var(--surface-base)]"
        >
          {/* Fixed-width inner box: content doesn't reflow while the pane animates open or closed. */}
          <div className="flex h-full flex-col" style={{ width }}>
            <AskChrome />
          </div>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize Ask LogBase"
            aria-valuenow={width}
            aria-valuemin={MIN_WIDTH}
            aria-valuemax={MAX_WIDTH}
            tabIndex={0}
            onPointerDown={onResizeStart}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeEnd}
            onPointerCancel={onResizeEnd}
            onDoubleClick={() => {
              setWidth(DEFAULT_WIDTH);
              saveWidth(DEFAULT_WIDTH);
            }}
            onKeyDown={onResizeKey}
            className="group absolute inset-y-0 left-0 z-10 w-1.5 -translate-x-0.5 cursor-col-resize touch-none outline-none"
          >
            <span
              className={`absolute inset-y-0 left-0.5 w-px transition-colors duration-150 group-hover:bg-[var(--muted)] group-focus-visible:bg-[var(--accent)] ${dragging ? "bg-[var(--accent)]" : "bg-transparent"}`}
            />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

/** Header + body of the pane — shared by the docked and the full-screen (phone) presentations. */
function AskChrome({ compact }: { compact?: boolean }) {
  const ask = useAsk()!;
  const { workspaceId, workspaceSlug, timeZone } = useWorkspaceRoute();
  const taskHref = useCallback((id: string) => `/${workspaceSlug}/work?task=${encodeURIComponent(id)}`, [workspaceSlug]);
  const heading = ask.view === "history" ? "History" : (ask.title ?? "Ask LogBase");

  return (
    <>
      <header className="flex h-11 shrink-0 items-center gap-1.5 border-b border-[var(--border-subtle)] pl-3.5 pr-1.5">
        <LogBaseMark size={16} decorative />
        <p className="ml-1 min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--fg)]" title={heading}>
          {heading}
        </p>
        <PaneButton label="New conversation" onClick={ask.newChat}>
          <path d="M10 4.5v11M4.5 10h11" />
        </PaneButton>
        <PaneButton
          label={ask.view === "history" ? "Back to conversation" : "History"}
          active={ask.view === "history"}
          onClick={() => ask.setView(ask.view === "history" ? "chat" : "history")}
        >
          <path d="M3.5 10a6.5 6.5 0 1 0 1.9-4.6M3.5 3.5v2.4h2.4M10 6.5V10l2.5 1.5" />
        </PaneButton>
        <PaneButton label="Close (Ctrl+K)" onClick={ask.close}>
          <path d="M5.5 5.5l9 9m0-9l-9 9" />
        </PaneButton>
      </header>

      {ask.view === "history" ? (
        <HistoryList organizationId={workspaceId} timeZone={timeZone} />
      ) : (
        <Conversation taskHref={taskHref} closeOnNavigate={!!compact} />
      )}
    </>
  );
}

function Conversation({ taskHref, closeOnNavigate }: { taskHref: (id: string) => string; closeOnNavigate: boolean }) {
  const ask = useAsk()!;
  const inputRef = useContext(AskInputContext)!;
  const router = useRouter();
  const { workspaceId } = useWorkspaceRoute();
  const [input, setInput] = useState("");
  const [highlight, setHighlight] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const onNavigate = closeOnNavigate ? ask.close : undefined;

  const isEmpty = ask.messages.length === 0 && !ask.running && !ask.error;
  const query = useDebounced(input.trim(), 220);
  const hits = useQuery({
    queryKey: ["agent-search", workspaceId, query],
    queryFn: () => apiJson<SearchHit[]>(`/organizations/${workspaceId}/search?q=${encodeURIComponent(query)}`),
    enabled: isEmpty && query.length >= 2,
    staleTime: 30_000,
  });
  const hitRows = isEmpty && query.length >= 2 ? (hits.data ?? []).slice(0, 6) : [];

  // Follow new content only while the reader is at (or near) the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [ask.messages.length, ask.draft, ask.liveSteps.length, ask.error]);

  const resizeInput = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const submit = () => {
    const picked = highlight >= 0 ? hitRows[highlight] : undefined;
    if (picked) {
      router.push(taskHref(picked.id));
      onNavigate?.();
      return;
    }
    if (!input.trim() || ask.running) return;
    stickToBottom.current = true;
    void ask.send(input);
    setInput("");
    setHighlight(-1);
    requestAnimationFrame(() => resizeInput(inputRef.current));
  };

  return (
    <>
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"
      >
        {isEmpty ? (
          hitRows.length > 0 || (query.length >= 2 && hits.isFetching) ? (
            <TaskMatches rows={hitRows} loading={hits.isFetching} highlight={highlight} taskHref={taskHref} onNavigate={onNavigate} />
          ) : (
            <EmptyState fromTask={!!ask.taskId} onSuggestion={(s) => void ask.send(s)} />
          )
        ) : (
          <div className="space-y-6">
            {ask.messages.map((m) =>
              m.role === "user" ? (
                <UserBubble key={m.id} text={m.content} />
              ) : (
                <AssistantTurn key={m.id} steps={m.steps?.map((s) => s.label) ?? []} text={m.content} taskHref={taskHref} onNavigate={onNavigate} />
              ),
            )}
            {ask.running && (
              <AssistantTurn live steps={ask.liveSteps} text={ask.draft} taskHref={taskHref} onNavigate={onNavigate} />
            )}
            {ask.error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-[var(--border-subtle)] px-3 py-2.5 text-[13px]">
                <span className="mt-0.5 size-1.5 shrink-0 translate-y-1 rounded-full bg-red-500" aria-hidden />
                <p className="min-w-0 flex-1 text-[var(--fg)]">{ask.error.message}</p>
                {ask.error.retry && (
                  <button
                    type="button"
                    onClick={() => void ask.send(ask.error!.retry!, { retry: true })}
                    className="shrink-0 rounded-md px-1.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--fg)]"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <form
        className="shrink-0 px-3 pb-3 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] transition-colors focus-within:border-[color-mix(in_srgb,var(--muted)_60%,var(--border))]">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            maxLength={4000}
            onChange={(e) => {
              setInput(e.target.value);
              setHighlight(-1);
              resizeInput(e.target);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                ask.close();
              } else if (hitRows.length > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                e.preventDefault();
                setHighlight((h) => (e.key === "ArrowDown" ? Math.min(h + 1, hitRows.length - 1) : Math.max(h - 1, -1)));
              } else if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={ask.taskId && !ask.threadId ? "Ask about this task…" : ask.threadId ? "Ask a follow-up…" : "Ask or search LogBase…"}
            className="block max-h-40 min-h-[2.75rem] w-full resize-none bg-transparent px-3.5 pb-1 pt-3 text-sm leading-relaxed text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none"
          />
          <div className="flex items-center justify-between gap-2 px-2.5 pb-2">
            <p className="truncate pl-1 text-[11px] text-[var(--muted)]">
              {ask.taskId && !ask.threadId ? "About this task · read-only" : "Reads your workspace · can't make changes yet"}
            </p>
            {ask.running ? (
              <button
                type="button"
                onClick={ask.stop}
                aria-label="Stop"
                title="Stop"
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--fg)] transition-[background-color,transform] duration-150 hover:bg-[var(--surface-hover)] active:scale-[0.94]"
              >
                <span className="size-2.5 rounded-[2px] bg-current" aria-hidden />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                aria-label="Ask"
                title="Ask (Enter)"
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)] transition-[opacity,transform] duration-150 active:scale-[0.94] disabled:opacity-25"
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden>
                  <path d="M10 15.5v-11M5.5 9 10 4.5 14.5 9" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </form>
    </>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-[var(--surface-elevated)] px-3.5 py-2 text-sm leading-relaxed text-[var(--fg)]">
        {text}
      </p>
    </div>
  );
}

function AssistantTurn({
  steps,
  text,
  live,
  taskHref,
  onNavigate,
}: {
  steps: string[];
  text: string;
  live?: boolean;
  taskHref: (id: string) => string;
  onNavigate?: () => void;
}) {
  const [showSteps, setShowSteps] = useState(false);
  const [copied, setCopied] = useState(false);
  const waiting = live && !text;

  return (
    <div className="group/turn flex gap-3">
      <span className="mt-0.5 shrink-0">
        <LogBaseMark size={18} decorative />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        {live ? (
          // While working: each finished lookup stays as a quiet line, the current one sits at the bottom.
          (steps.length > 0 || waiting) && (
            <ul className="space-y-0.5 font-mono text-[11px] leading-snug text-[var(--muted)]">
              {steps.map((s, i) => (
                <li key={i} className="truncate">
                  <span aria-hidden className="mr-1.5 opacity-50">›</span>
                  {s}
                </li>
              ))}
              {waiting && (
                <li className="flex items-center gap-1.5">
                  <span aria-hidden className="inline-block size-1.5 animate-pulse rounded-full bg-[var(--muted)]" />
                  {steps.length ? "Reading the results" : "Looking into it"}
                </li>
              )}
            </ul>
          )
        ) : (
          steps.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowSteps((v) => !v)}
                aria-expanded={showSteps}
                className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
              >
                <svg viewBox="0 0 12 12" className={`size-2.5 transition-transform duration-150 ${showSteps ? "rotate-90" : ""}`} aria-hidden>
                  <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
                </svg>
                {steps.length === 1 ? "1 lookup" : `${steps.length} lookups`}
              </button>
              {showSteps && (
                <ul className="mt-1 space-y-0.5 border-l border-[var(--border-subtle)] pl-2.5 font-mono text-[11px] leading-snug text-[var(--muted)]">
                  {steps.map((s, i) => (
                    <li key={i} className="truncate">
                      {s}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        )}
        {text && <AgentText text={text} taskHref={taskHref} onNavigate={onNavigate} />}
        {!live && text && (
          <div className="flex h-6 items-center opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover/turn:opacity-100">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(text.replace(/\[([^\]]+)\]\(task:[0-9a-f-]{36}\)/g, "$1"))
                  .then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1200);
                  })
                  .catch(() => undefined);
              }}
              className="rounded-md px-1.5 py-0.5 text-[11px] text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ fromTask, onSuggestion }: { fromTask: boolean; onSuggestion: (s: string) => void }) {
  return (
    <div className="flex h-full flex-col justify-end gap-4 pb-2">
      <div className="space-y-1.5">
        <LogBaseMark size={28} decorative />
        <p className="pt-1 text-[15px] font-semibold text-[var(--fg)]">{fromTask ? "Ask about this task" : "Ask LogBase"}</p>
        <p className="text-[13px] leading-relaxed text-[var(--muted)]">
          {fromTask
            ? "What's left, who's on it, what changed. LogBase reads the task and its history for you."
            : "Questions about tasks, people, deadlines or the roadmap. Type a few words to jump to a task instead."}
        </p>
      </div>
      <div className="flex flex-col items-start gap-1.5">
        {(fromTask ? TASK_SUGGESTIONS : SUGGESTIONS).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSuggestion(s)}
            className="rounded-full border border-[var(--border-subtle)] px-3 py-1 text-[13px] text-[var(--fg)] transition-colors hover:bg-[var(--surface-hover)]"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function TaskMatches({
  rows,
  loading,
  highlight,
  taskHref,
  onNavigate,
}: {
  rows: SearchHit[];
  loading: boolean;
  highlight: number;
  taskHref: (id: string) => string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col justify-end">
      <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Jump to a task</p>
      {rows.length === 0 && loading ? (
        <p className="px-2 text-xs text-[var(--muted)]">Searching…</p>
      ) : (
        <ul className="-mx-1">
          {rows.map((t, i) => (
            <li key={t.id}>
              <Link
                href={taskHref(t.id)}
                onClick={onNavigate}
                className={`block truncate rounded-lg px-3 py-1.5 text-sm text-[var(--fg)] transition-colors hover:bg-[var(--surface-hover)] ${i === highlight ? "bg-[var(--surface-hover)]" : ""}`}
              >
                {t.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 px-2 text-[11px] text-[var(--muted)]">
        <kbd className="font-sans">↑↓</kbd> pick a task · <kbd className="font-sans">Enter</kbd> ask LogBase
      </p>
    </div>
  );
}

function PaneButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-flex size-7 shrink-0 items-center justify-center rounded-md transition-[background-color,color,transform] duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--fg)] active:scale-[0.94] ${active ? "bg-[var(--surface-hover)] text-[var(--fg)]" : "text-[var(--muted)]"}`}
    >
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="size-[15px]" aria-hidden>
        {children}
      </svg>
    </button>
  );
}

function useDebounced<T>(value: T, ms: number): T {
  const [out, setOut] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setOut(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return out;
}

function HistoryList({ organizationId, timeZone }: { organizationId: string; timeZone: string }) {
  const ask = useAsk()!;
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const threads = useQuery({
    queryKey: agentKeys.threads(organizationId),
    queryFn: () => apiJson<AgentThreadSummary[]>(`/organizations/${organizationId}/agent/threads`),
    staleTime: 15_000,
  });

  const groups = useMemo(() => groupThreads(threads.data ?? [], timeZone), [threads.data, timeZone]);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: agentKeys.threads(organizationId) });

  if (threads.isLoading) {
    return (
      <div className="space-y-2 px-4 py-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-4 animate-pulse rounded bg-[var(--surface-hover)]" style={{ width: `${80 - i * 12}%` }} />
        ))}
      </div>
    );
  }
  if (threads.isError) return <p className="px-4 py-4 text-[13px] text-[var(--muted)]">Couldn&apos;t load your conversations.</p>;
  if (groups.length === 0) {
    return <p className="px-4 py-4 text-[13px] text-[var(--muted)]">No conversations yet. They&apos;ll show up here.</p>;
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3">
      {groups.map((g) => (
        <section key={g.label} className="mb-4">
          <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">{g.label}</p>
          <ul>
            {g.threads.map((t) => (
              <li
                key={t.id}
                className={`group flex items-center gap-0.5 rounded-lg pr-1 hover:bg-[var(--surface-hover)] ${t.id === ask.threadId ? "bg-[var(--surface-hover)]" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => void ask.loadThread(t.id)}
                  className="min-w-0 flex-1 truncate px-2.5 py-1.5 text-left text-[13px] text-[var(--fg)]"
                >
                  {t.title}
                </button>
                {confirmDelete === t.id ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await apiVoid(`/agent/threads/${t.id}`, { method: "DELETE" });
                      setConfirmDelete(null);
                      ask.forgetThread(t.id);
                      refresh();
                    }}
                    onBlur={() => setConfirmDelete(null)}
                    autoFocus
                    className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-red-600 hover:bg-red-500/10 dark:text-red-400"
                  >
                    Delete?
                  </button>
                ) : (
                  <>
                    <RowIcon
                      label={t.pinned ? "Unpin" : "Pin"}
                      visible={t.pinned}
                      onClick={async () => {
                        await apiJson(`/agent/threads/${t.id}`, { method: "PATCH", body: JSON.stringify({ pinned: !t.pinned }) });
                        refresh();
                      }}
                    >
                      <path d="M7 3h6l-1 5 3 3H5l3-3-1-5zM10 11v6" fill={t.pinned ? "currentColor" : "none"} />
                    </RowIcon>
                    <RowIcon label="Delete conversation" onClick={() => setConfirmDelete(t.id)}>
                      <path d="M4.5 6h11M8 6V4.5h4V6M6 6l.7 9.5h6.6L14 6" />
                    </RowIcon>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="px-2.5 pt-1 text-[11px] leading-relaxed text-[var(--muted)]">
        Conversations are private to you. Unpinned ones are cleared after 90 days.
      </p>
    </div>
  );
}

function RowIcon({
  label,
  visible,
  onClick,
  children,
}: {
  label: string;
  visible?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-flex size-6 shrink-0 items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--fg)] focus-visible:opacity-100 ${visible ? "" : "opacity-0 group-hover:opacity-100"}`}
    >
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden>
        {children}
      </svg>
    </button>
  );
}

function groupThreads(threads: AgentThreadSummary[], timeZone: string) {
  const now = new Date();
  const today = formatZonedDateKey(now, timeZone);
  const yesterday = formatZonedDateKey(new Date(now.getTime() - 86_400_000), timeZone);
  const weekAgo = now.getTime() - 7 * 86_400_000;
  const buckets = new Map<string, AgentThreadSummary[]>();
  const push = (label: string, t: AgentThreadSummary) => buckets.set(label, [...(buckets.get(label) ?? []), t]);
  for (const t of threads) {
    if (t.pinned) {
      push("Pinned", t);
      continue;
    }
    const at = new Date(t.lastMessageAt);
    const key = formatZonedDateKey(at, timeZone);
    if (key === today) push("Today", t);
    else if (key === yesterday) push("Yesterday", t);
    else if (at.getTime() >= weekAgo) push("Last 7 days", t);
    else push("Older", t);
  }
  return ["Pinned", "Today", "Yesterday", "Last 7 days", "Older"]
    .filter((l) => buckets.has(l))
    .map((label) => ({ label, threads: buckets.get(label)! }));
}
