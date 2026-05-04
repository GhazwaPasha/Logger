import { parseTaskDueRepeat, type TaskDueRepeat } from "@/lib/ledger-types";
import { PRIORITY_LABELS, TASK_FLOW_ORDER, type ManualTaskStatus, type TaskPriority } from "@/lib/task-board";

export type TaskAiFillMemberContext = { userId: string; name: string; email: string };

/** What the user already has in the task panel (so the model can add repeat without restating the due). */
export type TaskAiExistingDraft = {
  title?: string;
  /** Same shape as the due picker (`YYYY-MM-DDTHH:mm` or ""). */
  dueLocal?: string;
  dueRepeat?: TaskDueRepeat | null;
};

export type TaskAiFillRequestBody = {
  prompt: string;
  context: {
    timeZone: string;
    nowIso: string;
    members: TaskAiFillMemberContext[];
    existingDraft?: TaskAiExistingDraft | null;
  };
};

/** Sentinel: clear recurrence in the form (maps from model string `none` / `clear`). */
export type TaskAiDueRepeatClear = "none";

/**
 * Full snapshot from `/api/ai/task-fill`. Every key is always present.
 * - `null` on a field = **leave that form field unchanged** (except where noted).
 * - `subtasks: []` = clear draft subtasks (create: list; edit: new lines only).
 * - `assigneeUserIds: []` = clear assignees.
 * - `dueLocal: ""` = clear due (and the client clears repeat when due is cleared).
 * - `dueRepeat: "none"` = clear repeat cadence.
 */
export type TaskAiFillResult = {
  title: string | null;
  subtasks: string[] | null;
  assigneeUserIds: string[] | null;
  status: ManualTaskStatus | null;
  priority: TaskPriority | null;
  /** `null` = unchanged; `""` = clear due; else local `YYYY-MM-DDTHH:mm` when valid. */
  dueLocal: string | null;
  /** `null` = unchanged; `"none"` = clear; else cadence (only meaningful with a due). */
  dueRepeat: TaskDueRepeat | TaskAiDueRepeatClear | null;
};

const EMPTY_RESULT: TaskAiFillResult = {
  title: null,
  subtasks: null,
  assigneeUserIds: null,
  status: null,
  priority: null,
  dueLocal: null,
  dueRepeat: null,
};

const DUE_LOCAL_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Accepts API literals plus common phrasing models use instead of enums. */
export function parseDueRepeatLoose(v: unknown): TaskDueRepeat | null {
  if (v === null || v === "") return null;
  if (typeof v !== "string") return null;
  const s0 = v.trim().toLowerCase();
  const direct = parseTaskDueRepeat(s0);
  if (direct) return direct;
  const stripped = s0.replace(/^repeat\s+/i, "").replace(/\s+repeat$/i, "").trim();
  if (stripped !== s0 && stripped.length > 0) {
    const inner = parseDueRepeatLoose(stripped);
    if (inner) return inner;
  }
  const s = s0.replace(/\s+/g, " ").replace(/_/g, " ");
  if (s.includes("biweekly") || s.includes("bi-weekly")) return null;
  if (s === "every day" || s === "each day" || s === "once a day") return "daily";
  if (s === "every week" || s === "each week" || s === "once a week" || s === "per week") return "weekly";
  if (s === "every month" || s === "each month" || s === "once a month" || s === "per month") return "monthly";
  if (s === "every year" || s === "each year" || s === "once a year" || s === "per year" || s === "annually" || s === "annual")
    return "yearly";
  return null;
}

function isManualStatus(v: string): v is ManualTaskStatus {
  return (TASK_FLOW_ORDER as readonly string[]).includes(v);
}

function isTaskPriority(v: string): v is TaskPriority {
  return Object.prototype.hasOwnProperty.call(PRIORITY_LABELS, v);
}

/**
 * Maps model JSON to a full `TaskAiFillResult` (all keys set). Missing or invalid keys → `null` (no-op).
 * The model is expected to return every key; partial objects are tolerated for older clients.
 */
export function normalizeTaskAiFillPayload(raw: unknown, allowedAssigneeIds: Set<string>): TaskAiFillResult {
  const out: TaskAiFillResult = { ...EMPTY_RESULT };
  if (!raw || typeof raw !== "object") return out;
  const o = raw as Record<string, unknown>;

  if ("title" in o) {
    if (o.title === null) out.title = null;
    else if (typeof o.title === "string") {
      const t = o.title.trim();
      out.title = t ? t.slice(0, 500) : null;
    }
  }

  if ("subtasks" in o) {
    if (o.subtasks === null) out.subtasks = null;
    else if (Array.isArray(o.subtasks)) {
      out.subtasks = o.subtasks
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 100);
    }
  }

  if ("assigneeUserIds" in o) {
    if (o.assigneeUserIds === null) out.assigneeUserIds = null;
    else if (Array.isArray(o.assigneeUserIds)) {
      out.assigneeUserIds = [
        ...new Set(
          o.assigneeUserIds
            .filter((x): x is string => typeof x === "string")
            .map((s) => s.trim())
            .filter((id) => allowedAssigneeIds.has(id)),
        ),
      ];
    }
  }

  if ("status" in o) {
    if (o.status === null) out.status = null;
    else if (typeof o.status === "string" && isManualStatus(o.status)) out.status = o.status;
    else out.status = null;
  }

  if ("priority" in o) {
    if (o.priority === null) out.priority = null;
    else if (typeof o.priority === "string" && isTaskPriority(o.priority)) out.priority = o.priority;
    else out.priority = null;
  }

  if ("dueLocal" in o) {
    if (o.dueLocal === null) out.dueLocal = null;
    else if (o.dueLocal === "") out.dueLocal = "";
    else if (typeof o.dueLocal === "string") {
      const d = o.dueLocal.trim();
      if (!d) out.dueLocal = "";
      else if (DUE_LOCAL_RE.test(d)) out.dueLocal = d;
      else out.dueLocal = null;
    }
  }

  const ext = o as Record<string, unknown>;
  const repeatRaw =
    ext.dueRepeat ?? ext.repeat ?? ext.recurrence ?? (typeof ext.repeatCadence === "string" ? ext.repeatCadence : undefined);

  if ("dueRepeat" in o || repeatRaw !== undefined) {
    const src = repeatRaw !== undefined ? repeatRaw : ext.dueRepeat;
    if (src === null) out.dueRepeat = null;
    else if (typeof src === "string") {
      const low = src.trim().toLowerCase();
      if (low === "none" || low === "clear") out.dueRepeat = "none";
      else {
        const r = parseDueRepeatLoose(low);
        out.dueRepeat = r;
      }
    } else out.dueRepeat = null;
  }

  return out;
}

/** @deprecated Use {@link normalizeTaskAiFillPayload} */
export const sanitizeTaskAiFillPayload = normalizeTaskAiFillPayload;

/** True when the model did not propose any change (all fields `null` / no-op). */
export function taskAiFillResultIsEmpty(r: TaskAiFillResult): boolean {
  return (
    r.title === null &&
    r.subtasks === null &&
    r.assigneeUserIds === null &&
    r.status === null &&
    r.priority === null &&
    r.dueLocal === null &&
    r.dueRepeat === null
  );
}
