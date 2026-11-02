"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { POP_EASE } from "@/components/ui/motion-presets";
import { AiIcon } from "./AiIcon";
import { useAsk, type TaskRef } from "./AskPanel";

/**
 * Wraps one board card. Ctrl/⌘- or Shift-click selects it (instead of opening it) for the command bar, and it
 * lights up when Ask's latest answer mentions it, so answers point at the board beside the pane.
 */
export function BoardCardFrame({
  task,
  selected,
  onToggleSelect,
  children,
}: {
  task: TaskRef;
  selected: boolean;
  onToggleSelect: (task: TaskRef) => void;
  children: ReactNode;
}) {
  const ask = useAsk();
  const highlighted = !!ask?.highlightIds.has(task.id);
  const ref = useRef<HTMLDivElement>(null);

  // Bring a highlighted card into view once, when an answer first points at it.
  const wasHighlighted = useRef(false);
  useEffect(() => {
    if (highlighted && !wasHighlighted.current) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    wasHighlighted.current = highlighted;
  }, [highlighted]);

  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    if (!(e.metaKey || e.ctrlKey || e.shiftKey)) return;
    // Selection gesture: keep the click from reaching the card's own buttons (open, status…).
    e.preventDefault();
    e.stopPropagation();
    onToggleSelect(task);
  };

  return (
    <div
      ref={ref}
      data-task-id={task.id}
      onClickCapture={onClickCapture}
      className={`relative rounded-xl transition-shadow duration-200 ${
        selected
          ? "shadow-[0_0_0_2px_var(--accent)]"
          : highlighted
            ? "shadow-[0_0_0_1.5px_rgb(56_189_248/0.85),0_0_0_5px_rgb(56_189_248/0.14)]"
            : ""
      }`}
    >
      {children}
      {highlighted && !selected && (
        <span
          className="pointer-events-none absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-sky-400 text-[var(--surface-base)] shadow-sm"
          title="Mentioned in Ask LogBase"
          aria-hidden
        >
          <AiIcon className="size-3" />
        </span>
      )}
    </div>
  );
}

const QUICK_ASKS = ["Summarize these", "What's blocking these?", "Who should own these?"];
const QUICK_ASKS_ONE = ["Summarize this", "What's blocking it?", "Who should own it?"];

/**
 * Appears when cards are selected: ask about exactly those tasks. Sits over the board, clear of the sidebar
 * and the docked Ask pane.
 */
export function SelectionAskBar({ selection, onClear }: { selection: TaskRef[]; onClear: () => void }) {
  const ask = useAsk();
  const reduceMotion = useReducedMotion();
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selection.length) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClear();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selection.length, onClear]);

  if (!ask) return null;

  const go = (prompt?: string) => {
    ask.askAboutSelection(selection, prompt?.trim() || undefined);
    setText("");
    onClear();
  };

  return (
    <AnimatePresence>
      {selection.length > 0 && (
        <motion.div
          key="selection-bar"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: reduceMotion ? 0 : 0.18, ease: POP_EASE }}
          className="pointer-events-none fixed bottom-5 left-0 z-50 flex justify-center px-4 md:left-72"
          style={{ right: "var(--ask-pane-w, 0px)" }}
        >
          <form
            className="pointer-events-auto w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-2xl shadow-black/30"
            onSubmit={(e) => {
              e.preventDefault();
              go(text);
            }}
          >
            {/* Quick asks get their own row so the input always keeps its full width. */}
            <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border-subtle)] px-3 py-1.5">
              <span className="mr-1 text-[11px] text-[var(--muted)]">
                {selection.length === 1 ? "1 task selected" : `${selection.length} tasks selected`}
              </span>
              {(selection.length === 1 ? QUICK_ASKS_ONE : QUICK_ASKS).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => go(q)}
                  className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[11px] text-[var(--fg)] transition-colors hover:bg-[var(--surface-hover)]"
                >
                  {q}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 py-1.5 pl-3 pr-1.5">
            <AiIcon className="size-4 shrink-0 text-[var(--muted)]" />
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={selection.length === 1 ? "Ask about this task…" : `Ask about these ${selection.length} tasks…`}
              className="min-w-0 flex-1 bg-transparent py-1 text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none"
              aria-label="Ask about the selected tasks"
            />
            <button
              type="submit"
              className="inline-flex h-7 shrink-0 items-center rounded-lg bg-[var(--accent)] px-2.5 text-xs font-medium text-[var(--on-accent)] transition-transform active:scale-[0.96]"
            >
              Ask
            </button>
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear selection (Esc)"
              title="Clear selection (Esc)"
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="size-3.5" aria-hidden>
                <path d="M6 6l8 8m0-8-8 8" />
              </svg>
            </button>
            </div>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
