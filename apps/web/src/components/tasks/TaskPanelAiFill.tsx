"use client";

import { startTransition, useCallback, useId, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import { LogBaseMark } from "@/components/brand/LogBaseMark";
import { Toggle } from "@/components/ui/Toggle";
import type { MemberRow } from "@/lib/ledger-types";
import type {
  TaskAiExistingDraft,
  TaskAiFillMemberContext,
  TaskAiFillRequestBody,
  TaskAiFillResult,
} from "@/lib/task-ai-fill";

type TaskPanelAiFillProps = {
  members: MemberRow[];
  /** Current panel fields so the model can set recurrence without restating the due. */
  existingDraft?: TaskAiExistingDraft | null;
  onApply: (result: TaskAiFillResult) => void;
};

function membersToContext(members: MemberRow[]): TaskAiFillMemberContext[] {
  return members.map((m) => ({
    userId: m.userId,
    name: m.name,
    email: m.email,
  }));
}

/** Keys present in {@link TaskAiFillResult} when the model supplied a change (value not `null`). */
type TaskAiFillAppliedKey = keyof TaskAiFillResult;

const TASK_AI_FILL_SUCCESS_ORDER: TaskAiFillAppliedKey[] = [
  "title",
  "subtasks",
  "assigneeUserIds",
  "dueLocal",
  "dueRepeat",
  "status",
  "priority",
];

const TASK_AI_FILL_SUCCESS_LABELS: Record<TaskAiFillAppliedKey, string> = {
  title: "Tasks",
  subtasks: "Subtask",
  assigneeUserIds: "Member",
  status: "Status",
  priority: "Priority",
  dueLocal: "Due Date",
  dueRepeat: "Recurrence",
};

function taskAiFillSuccessHint(result: TaskAiFillResult): string {
  const appliedKeys = TASK_AI_FILL_SUCCESS_ORDER.filter((k) => result[k] !== null);
  if (appliedKeys.length === 0) return "Success.";
  const labels = appliedKeys.map((k) => TASK_AI_FILL_SUCCESS_LABELS[k]);
  return `Success: ${labels.join(", ")}.`;
}

export function TaskPanelAiFill({ members, existingDraft = null, onApply }: TaskPanelAiFillProps) {
  const baseId = useId();
  const panelId = `${baseId}-ai-panel`;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okHint, setOkHint] = useState<string | null>(null);

  const apply = useCallback(async () => {
    const prompt = text.trim();
    if (!prompt) {
      setError("Describe the task in plain language first.");
      return;
    }
    setError(null);
    setOkHint(null);
    setLoading(true);
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const nowIso = new Date().toISOString();
      const payload: TaskAiFillRequestBody = {
        prompt,
        context: {
          timeZone,
          nowIso,
          members: membersToContext(members),
          ...(existingDraft ? { existingDraft } : {}),
        },
      };
      const res = await fetch("/api/ai/task-fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as { result?: TaskAiFillResult; error?: string };
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : res.statusText || "Request failed");
        return;
      }
      if (!json.result) {
        setError("Unexpected response");
        return;
      }
      const appliedResult = json.result;
      startTransition(() => {
        onApply(appliedResult);
        setOkHint(taskAiFillSuccessHint(appliedResult));
        setText("");
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [existingDraft, members, onApply, text]);

  return (
    <div className="rounded-3xl border border-blue-500/30 bg-blue-500/[0.06] p-5 space-y-3 dark:bg-blue-500/[0.07]">
      <div className="flex items-center justify-between gap-2 text-sm font-semibold text-[var(--fg)]">
        <span className="inline-flex items-center gap-2">
          <FontAwesomeIcon icon={faWandMagicSparkles} className="size-[18px] text-blue-500" aria-hidden />
          Describe your task in natural language
        </span>
        <Toggle
          checked={open}
          aria-label="Describe your task in natural language"
          activeClassName="bg-blue-500"
          onChange={(next) => {
            setOpen(next);
            setError(null);
            setOkHint(null);
          }}
        />
      </div>
      {open && (
        <div id={panelId} className="space-y-2">
          <textarea
            className={[
              "min-h-[5.5rem] w-full resize-y rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--fg)]",
              "bg-blue-500/[0.05] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]",
              "placeholder:text-[var(--muted)]",
              "outline-none transition-[border-color,box-shadow,ring-color]",
              "focus-visible:border-blue-500/22 focus-visible:ring-2 focus-visible:ring-blue-500/12 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)]",
              "dark:bg-blue-500/[0.07]",
              "dark:focus-visible:border-blue-400/25 dark:focus-visible:ring-blue-400/10 dark:focus-visible:ring-offset-[var(--surface-base)]",
            ].join(" ")}
            placeholder="e.g. High priority — have Dana review the Q2 deck by Friday 5pm, recurring weekly until done. Add subtasks: outline, slides, dry run."
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Describe your task in natural language"
          />
          <button
            type="button"
            className={[
              "flex min-h-10 w-full items-center justify-center rounded-md border border-[var(--border-subtle)] px-3 py-2",
              "bg-blue-500/12 text-sm font-medium text-[var(--fg)]",
              "transition-[background-color,border-color,transform]",
              "hover:bg-blue-500/18 hover:border-[var(--border)] active:scale-[0.99]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/15 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)]",
              "disabled:pointer-events-none disabled:opacity-50",
              "dark:bg-blue-500/14 dark:hover:bg-blue-500/20 dark:hover:border-[var(--border)]",
              "dark:focus-visible:ring-blue-400/12",
            ].join(" ")}
            disabled={loading}
            aria-busy={loading}
            aria-label={loading ? "Applying Ai fill" : "Ai fill"}
            onClick={() => void apply()}
          >
            {loading ? (
              <span className="task-ai-fill-loading-track" aria-hidden>
                <span className="task-ai-fill-loading-thumb" />
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span className="text-sm font-medium text-[var(--fg)]">Ai fill</span>
                <LogBaseMark variant="chrome" size={16} decorative className="shrink-0" />
              </span>
            )}
          </button>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          {okHint && !error && <p className="text-xs text-emerald-700 dark:text-emerald-400">{okHint}</p>}
        </div>
      )}
    </div>
  );
}
