"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  formatZonedDateKey,
  type AgentMessage,
  type AgentThreadDetail,
  type AgentThreadSummary,
} from "@work-ledger/contracts";
import { LogBaseMark } from "@/components/brand/LogBaseMark";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { InlineSpinner } from "@/components/ui/InlineSpinner";
import { POP_EASE } from "@/components/ui/motion-presets";
import { ApiError, apiJson, apiVoid } from "@/lib/api";
import { agentKeys, streamAsk } from "@/lib/agent";
import { AgentText } from "./AgentText";

type OpenAskOptions = { prompt?: string; taskId?: string; send?: boolean };
type AskContextValue = { openAsk: (opts?: OpenAskOptions) => void; toggleAsk: () => void; isOpen: boolean };

const AskContext = createContext<AskContextValue | null>(null);

/** Null outside a workspace (the header also renders on `/app`), so callers can hide their entry point. */
export function useAsk(): AskContextValue | null {
  return useContext(AskContext);
}

type ChatMessage = Pick<AgentMessage, "id" | "role" | "content" | "steps">;
type SearchHit = { id: string; title: string; status: string };

const SUGGESTIONS = ["What's overdue right now?", "What's due for me this week?", "What changed today?"];

/**
 * "Ask LogBase": a right-hand panel (full screen on phones) opened from the header mark or ⌘K. Typing shows
 * matching tasks straight away; Enter asks the agent. Conversations are kept and listed under History.
 */
export function AskProvider({ children }: { children: ReactNode }) {
  const { workspaceId, workspaceSlug, timeZone } = useWorkspaceRoute();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"chat" | "history">("chat");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [liveStep, setLiveStep] = useState<string | null>(null);
  const [liveSteps, setLiveSteps] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const taskHref = useCallback((id: string) => `/${workspaceSlug}/work?task=${encodeURIComponent(id)}`, [workspaceSlug]);

  const focusInput = () => setTimeout(() => inputRef.current?.focus(), 60);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setThreadId(null);
    setTitle(null);
    setTaskId(null);
    setMessages([]);
    setLiveSteps([]);
    setLiveStep(null);
    setRunning(false);
    setError(null);
  }, []);

  const send = useCallback(
    async (text: string, opts?: { taskId?: string | null; fresh?: boolean }) => {
      const message = text.trim();
      if (!message || running) return;
      // `fresh`: the caller just reset the conversation, so this render's `threadId` is stale.
      const currentThreadId = opts?.fresh ? null : threadId;
      setInput("");
      setError(null);
      setView("chat");
      setRunning(true);
      setLiveSteps([]);
      setLiveStep(null);
      setMessages((m) => [...m, { id: `local-${Date.now()}`, role: "user", content: message, steps: null }]);

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const steps: string[] = [];
      try {
        await streamAsk(
          workspaceId,
          {
            message,
            threadId: currentThreadId ?? undefined,
            taskId: currentThreadId ? undefined : (opts?.taskId ?? taskId ?? undefined),
          },
          (e) => {
            if (e.type === "thread") {
              setThreadId(e.threadId);
              setTitle(e.title);
            } else if (e.type === "step") {
              steps.push(e.label);
              setLiveSteps([...steps]);
              setLiveStep(e.label);
            } else if (e.type === "answer") {
              setTitle(e.title);
              setMessages((m) => [...m, { id: e.messageId, role: "assistant", content: e.text, steps: steps.map((label) => ({ label })) }]);
            } else if (e.type === "error") {
              setError(e.message);
            }
          },
          ctrl.signal,
        );
      } catch (err) {
        if (!ctrl.signal.aborted) setError(err instanceof ApiError || err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        if (abortRef.current === ctrl) {
          setRunning(false);
          setLiveStep(null);
          setLiveSteps([]);
          void queryClient.invalidateQueries({ queryKey: agentKeys.threads(workspaceId) });
        }
      }
    },
    [running, threadId, taskId, workspaceId, queryClient],
  );

  const openAsk = useCallback(
    (opts?: OpenAskOptions) => {
      setOpen(true);
      setView("chat");
      const switchingTask = !!opts?.taskId && opts.taskId !== taskId;
      if (switchingTask) {
        reset();
        setTaskId(opts!.taskId!);
      }
      if (opts?.prompt && opts.send) void send(opts.prompt, { taskId: opts.taskId, fresh: switchingTask });
      else if (opts?.prompt) setInput(opts.prompt);
      focusInput();
    },
    [reset, send, taskId],
  );

  const toggleAsk = useCallback(() => {
    setOpen((o) => {
      if (!o) focusInput();
      return !o;
    });
  }, []);

  const loadThread = useCallback(
    async (id: string) => {
      reset();
      setView("chat");
      try {
        const detail = await queryClient.fetchQuery({
          queryKey: agentKeys.thread(id),
          queryFn: () => apiJson<AgentThreadDetail>(`/agent/threads/${id}`),
          staleTime: 0,
        });
        setThreadId(detail.id);
        setTitle(detail.title);
        setTaskId(detail.taskId);
        setMessages(detail.messages);
      } catch {
        setError("Couldn't open that conversation.");
      }
      focusInput();
    },
    [queryClient, reset],
  );

  // ⌘K / Ctrl+K anywhere in the workspace; Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggleAsk();
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, toggleAsk]);

  // Keep the newest turn in view.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, liveStep, error]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const ctx = useMemo<AskContextValue>(() => ({ openAsk, toggleAsk, isOpen: open }), [openAsk, toggleAsk, open]);

  return (
    <AskContext.Provider value={ctx}>
      {children}
      <AnimatePresence>
        {open && (
          <motion.aside
            key="ask"
            role="dialog"
            aria-label="Ask LogBase"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.18, ease: POP_EASE }}
            className="fixed inset-x-0 bottom-0 top-14 z-[45] flex flex-col border-l border-[var(--border-subtle)] bg-[var(--surface-base)] shadow-2xl shadow-black/10 sm:left-auto sm:w-[26rem] dark:shadow-black/40"
          >
            <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] px-3">
              <LogBaseMark size={18} decorative />
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--fg)]">
                {view === "history" ? "History" : (title ?? "Ask LogBase")}
              </p>
              <HeaderButton
                label="New conversation"
                onClick={() => {
                  reset();
                  focusInput();
                }}
              >
                <path d="M10 4.5v11M4.5 10h11" />
              </HeaderButton>
              <HeaderButton
                label={view === "history" ? "Back to conversation" : "History"}
                active={view === "history"}
                onClick={() => setView((v) => (v === "history" ? "chat" : "history"))}
              >
                <path d="M3.5 10a6.5 6.5 0 1 0 1.9-4.6M3.5 3.5v2.4h2.4M10 6.5V10l2.5 1.5" />
              </HeaderButton>
              <HeaderButton label="Close (Esc)" onClick={() => setOpen(false)}>
                <path d="M5.5 5.5l9 9m0-9l-9 9" />
              </HeaderButton>
            </header>

            {view === "history" ? (
              <HistoryList
                organizationId={workspaceId}
                timeZone={timeZone}
                activeId={threadId}
                onOpen={loadThread}
                onDeleted={(id) => {
                  if (id === threadId) reset();
                }}
              />
            ) : (
              <>
                <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
                  {messages.length === 0 && !running ? (
                    <EmptyChat
                      organizationId={workspaceId}
                      query={input}
                      fromTask={!!taskId}
                      taskHref={taskHref}
                      onSuggestion={(s) => void send(s)}
                      onNavigate={() => setOpen(false)}
                    />
                  ) : (
                    <div className="space-y-5">
                      {messages.map((m) =>
                        m.role === "user" ? (
                          <p key={m.id} className="whitespace-pre-wrap text-sm font-medium text-[var(--fg)]">
                            {m.content}
                          </p>
                        ) : (
                          <div key={m.id} className="flex gap-2.5">
                            <span className="mt-0.5 shrink-0">
                              <LogBaseMark size={16} decorative />
                            </span>
                            <div className="min-w-0 flex-1 space-y-2">
                              {m.steps && m.steps.length > 0 && <StepTrail steps={m.steps.map((s) => s.label)} />}
                              <AgentText text={m.content} taskHref={taskHref} onNavigate={() => setOpen(false)} />
                            </div>
                          </div>
                        ),
                      )}
                      {running && (
                        <div className="flex gap-2.5">
                          <span className="mt-0.5 shrink-0">
                            <LogBaseMark size={16} decorative />
                          </span>
                          <div className="min-w-0 flex-1 space-y-1.5">
                            {liveSteps.length > 1 && <StepTrail steps={liveSteps.slice(0, -1)} />}
                            <p className="flex items-center gap-2 text-xs text-[var(--muted)]">
                              <InlineSpinner className="size-3 animate-spin" />
                              {liveStep ?? "Working on it"}
                            </p>
                          </div>
                        </div>
                      )}
                      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                    </div>
                  )}
                </div>

                <form
                  className="shrink-0 border-t border-[var(--border-subtle)] p-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send(input);
                  }}
                >
                  <div className="flex items-end gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 focus-within:border-[var(--muted)]">
                    <textarea
                      ref={inputRef}
                      rows={1}
                      value={input}
                      maxLength={4000}
                      onChange={(e) => {
                        setInput(e.target.value);
                        e.target.style.height = "auto";
                        e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          void send(input);
                        }
                      }}
                      placeholder={taskId && !threadId ? "Ask about this task…" : "Ask or search LogBase…"}
                      className="max-h-[140px] min-h-[1.5rem] flex-1 resize-none bg-transparent text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || running}
                      aria-label="Ask"
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--on-accent)] transition-[opacity,transform] duration-150 active:scale-[0.94] disabled:opacity-30"
                    >
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden>
                        <path d="M10 16V4M5 9l5-5 5 5" />
                      </svg>
                    </button>
                  </div>
                  <p className="mt-1.5 px-1 text-[10px] text-[var(--muted)]">
                    LogBase can read your workspace but can&apos;t change anything yet.
                  </p>
                </form>
              </>
            )}
          </motion.aside>
        )}
      </AnimatePresence>
    </AskContext.Provider>
  );
}

function HeaderButton({
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
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg transition-[background-color,color,transform] duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--fg)] active:scale-[0.94] ${active ? "bg-[var(--surface-hover)] text-[var(--fg)]" : "text-[var(--muted)]"}`}
    >
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden>
        {children}
      </svg>
    </button>
  );
}

/** The tools the agent ran, one muted line each — the record of how it got its answer. */
function StepTrail({ steps }: { steps: string[] }) {
  return (
    <ul className="space-y-0.5 font-mono text-[11px] leading-snug text-[var(--muted)]">
      {steps.map((s, i) => (
        <li key={i} className="truncate">
          <span aria-hidden className="mr-1.5 opacity-60">
            ›
          </span>
          {s}
        </li>
      ))}
    </ul>
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

/** Fresh conversation: matching tasks while typing (search), otherwise a few starter questions. */
function EmptyChat({
  organizationId,
  query,
  fromTask,
  taskHref,
  onSuggestion,
  onNavigate,
}: {
  organizationId: string;
  query: string;
  fromTask: boolean;
  taskHref: (id: string) => string;
  onSuggestion: (s: string) => void;
  onNavigate: () => void;
}) {
  const q = useDebounced(query.trim(), 250);
  const hits = useQuery({
    queryKey: ["agent-search", organizationId, q],
    queryFn: () => apiJson<SearchHit[]>(`/organizations/${organizationId}/search?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
    staleTime: 30_000,
  });

  if (q.length >= 2) {
    const rows = (hits.data ?? []).slice(0, 6);
    return (
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Tasks</p>
        {hits.isLoading ? (
          <p className="text-xs text-[var(--muted)]">Searching…</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">No task titles match. Press Enter to ask LogBase instead.</p>
        ) : (
          <ul className="-mx-2">
            {rows.map((t) => (
              <li key={t.id}>
                <Link
                  href={taskHref(t.id)}
                  onClick={onNavigate}
                  className="block truncate rounded-lg px-2 py-1.5 text-sm text-[var(--fg)] transition-colors hover:bg-[var(--surface-hover)]"
                >
                  {t.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-[var(--muted)]">
          Press <kbd className="rounded border border-[var(--border-subtle)] px-1 font-mono">Enter</kbd> to ask LogBase.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col justify-end gap-3 pb-1">
      <p className="text-sm text-[var(--muted)]">
        {fromTask
          ? "Ask anything about this task: what's left, who's on it, what changed."
          : "Ask about tasks, people, deadlines or the roadmap. LogBase looks it up for you."}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {(fromTask ? ["Summarize this task", "What's still left to do?", "Who changed what recently?"] : SUGGESTIONS).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSuggestion(s)}
            className="rounded-full border border-[var(--border-subtle)] px-3 py-1 text-xs text-[var(--fg)] transition-colors hover:bg-[var(--surface-hover)]"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function HistoryList({
  organizationId,
  timeZone,
  activeId,
  onOpen,
  onDeleted,
}: {
  organizationId: string;
  timeZone: string;
  activeId: string | null;
  onOpen: (id: string) => void;
  onDeleted: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const threads = useQuery({
    queryKey: agentKeys.threads(organizationId),
    queryFn: () => apiJson<AgentThreadSummary[]>(`/organizations/${organizationId}/agent/threads`),
    staleTime: 15_000,
  });

  const groups = useMemo(() => groupThreads(threads.data ?? [], timeZone), [threads.data, timeZone]);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: agentKeys.threads(organizationId) });

  if (threads.isLoading) return <p className="px-4 py-4 text-xs text-[var(--muted)]">Loading…</p>;
  if (threads.isError) return <p className="px-4 py-4 text-xs text-[var(--muted)]">Couldn&apos;t load your conversations.</p>;
  if (groups.length === 0) {
    return <p className="px-4 py-4 text-sm text-[var(--muted)]">No conversations yet. They&apos;ll show up here.</p>;
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3">
      {groups.map((g) => (
        <section key={g.label} className="mb-3">
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">{g.label}</p>
          <ul>
            {g.threads.map((t) => (
              <li key={t.id} className="group flex items-center gap-1 rounded-lg hover:bg-[var(--surface-hover)]">
                <button
                  type="button"
                  onClick={() => onOpen(t.id)}
                  className={`min-w-0 flex-1 truncate px-2 py-1.5 text-left text-sm ${t.id === activeId ? "font-medium text-[var(--fg)]" : "text-[var(--fg)]"}`}
                >
                  {t.title}
                </button>
                <button
                  type="button"
                  aria-label={t.pinned ? "Unpin" : "Pin"}
                  title={t.pinned ? "Unpin" : "Pin"}
                  onClick={async () => {
                    await apiJson(`/agent/threads/${t.id}`, { method: "PATCH", body: JSON.stringify({ pinned: !t.pinned }) });
                    refresh();
                  }}
                  className={`inline-flex size-7 items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--fg)] ${t.pinned ? "" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"}`}
                >
                  <svg viewBox="0 0 20 20" fill={t.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.5} className="size-3.5" aria-hidden>
                    <path d="M7 3h6l-1 5 3 3H5l3-3-1-5zM10 11v6" strokeLinejoin="round" strokeLinecap="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label="Delete conversation"
                  title="Delete"
                  onClick={async () => {
                    await apiVoid(`/agent/threads/${t.id}`, { method: "DELETE" });
                    onDeleted(t.id);
                    refresh();
                  }}
                  className="mr-1 inline-flex size-7 items-center justify-center rounded-md text-[var(--muted)] opacity-0 hover:text-[var(--fg)] focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" className="size-3.5" aria-hidden>
                    <path d="M4.5 6h11M8 6V4.5h4V6M6 6l.7 9.5h6.6L14 6" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="px-2 pt-2 text-[10px] text-[var(--muted)]">Conversations are private to you. Unpinned ones are cleared after 90 days.</p>
    </div>
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
