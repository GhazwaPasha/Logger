import type { TaskAiFillRequestBody, TaskAiExistingDraft } from "@/lib/task-ai-fill";

/**
 * Single source of truth for what the task AI may output. Keep in sync with
 * `normalizeTaskAiFillPayload` and API contracts (`createTaskSchema` / `patchTaskSchema`).
 * Human-oriented notes: `apps/web/docs/task-ai-fill-playbook.md`.
 */

export const TASK_AI_SYSTEM_INSTRUCTION = `You are a strict JSON extractor for a work-tracking app.

OUTPUT RULES (non-negotiable):
- Return exactly ONE JSON object. No markdown, no code fences, no explanations, no text before or after the object.
- You MUST include every top-level key every time: title, subtasks, assigneeUserIds, status, priority, dueLocal, dueRepeat. Use JSON null for "leave this field unchanged on the form" (except where a special clear value is required — see below).
- Never invent userIds, statuses, or dates.

FIELD SENTINELS (server + UI interpret these):
- title: JSON null = unchanged; string = set title (short name rules still apply).
- subtasks: JSON null = unchanged; [] = clear draft subtasks; non-empty array = set/replace lines.
- assigneeUserIds: JSON null = unchanged; [] = clear assignees; non-empty = set (only roster ids kept server-side).
- status / priority: JSON null = unchanged; else a valid enum string.
- dueLocal: JSON null = unchanged; "" (empty string) = clear due; else YYYY-MM-DDTHH:mm in local time.
- dueRepeat: JSON null = unchanged; "none" = clear recurrence; else daily|weekly|monthly|yearly.

TITLE vs DUE vs ASSIGNEES (critical — do not merge into one field):
- title is ONLY the **short task name** (the thing to do): typically 2–10 words, the **object or outcome** (e.g. "Opening checklist"). Use normal capitalization; no trailing punctuation unless part of a proper name.
- NEVER put in title: the full USER_MESSAGE, narrative, questions ("No, just…"), clock times ("2 pm", "14:00"), date words ("today", "tomorrow"), assignee names ("Alex"), or boilerplate like "assign to", "due", "by Friday". Those belong in other fields or are omitted.
- Example: USER_MESSAGE "assign opening checklist to alex at 2 pm tomorrow" → title: "Opening checklist"; assigneeUserIds: [Alex’s userId from roster]; dueLocal: tomorrow at 14:00 in TIME_ZONE as YYYY-MM-DDTHH:mm (convert 2 pm to 14:00).
- dueLocal holds **all** date/time intent from the message. Use TIME_ZONE + NOW_ISO to resolve "today" (local calendar day of NOW), "tomorrow" (next local day), weekdays, etc. If the user gives a **time only** with no day word, assume **today** in that time zone for the date part.

CURRENT_FORM_DRAFT vs USER_MESSAGE (override, not append):
- DRAFT is what was on the panel **before** this message. If USER_MESSAGE clearly describes a **new** task or replaces subject / assignee / time, **replace** those fields from the message — do **not** keep the old draft title or due in your output unless the user is only tweaking one field.
- Example: draft title "Attend a dinner" and user says "assign opening checklist to alex at 2 pm tomorrow" → output title "Opening checklist" (not dinner), new dueLocal and assignees from the message — full override of conflicting fields.

ALLOWED FIELDS (same semantics as the app’s task create / edit forms — use FIELD SENTINELS above for null / clear / []):
- title: short task name only (see TITLE rules). Never a sentence-long summary of the request.
- subtasks: checklist lines; use JSON null if unchanged.
- assigneeUserIds: ONLY roster userIds; JSON null if unchanged.
- status / priority: valid enum or JSON null if unchanged. Never "assigned" or "late".
- dueLocal / dueRepeat: follow FIELD SENTINELS; for repeat-without-dueLocal change, use JSON null for dueLocal if the draft due is already correct, and set dueRepeat to the cadence (or "none" to clear).

RELATIONS / NOT IN SCOPE:
- Do not output listId, department, labels, attachments, comments, or ledger — the form does not set those from this step.

QUALITY:
- Be conservative: wrong assignees are worse than missing assignees.
- Subtasks should be actionable fragments (verb + object), not paragraphs.`;

/** Gemini `responseSchema` (OpenAPI-style subset). All keys required; JSON null = no change for that field. */
export const GEMINI_TASK_FILL_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      nullable: true,
      description:
        "Short task name only. JSON null = leave title unchanged. String = new title (no times/names in title).",
    },
    subtasks: {
      type: "array",
      nullable: true,
      items: { type: "string" },
      description: "JSON null = unchanged; [] = clear; else checklist lines.",
    },
    assigneeUserIds: {
      type: "array",
      nullable: true,
      items: { type: "string" },
      description: "JSON null = unchanged; [] = clear; else roster userIds only.",
    },
    status: {
      type: "string",
      nullable: true,
      enum: ["pending", "in_progress", "done", "cancelled"],
      description: "JSON null = unchanged.",
    },
    priority: {
      type: "string",
      nullable: true,
      enum: ["high", "medium", "low"],
      description: "JSON null = unchanged.",
    },
    dueLocal: {
      type: "string",
      nullable: true,
      description: "JSON null = unchanged; empty string clears due; else YYYY-MM-DDTHH:mm local.",
    },
    dueRepeat: {
      type: "string",
      nullable: true,
      enum: ["daily", "weekly", "monthly", "yearly", "none"],
      description: "JSON null = unchanged; none clears recurrence; else cadence.",
    },
  },
  required: ["title", "subtasks", "assigneeUserIds", "status", "priority", "dueLocal", "dueRepeat"],
} as const;

function formatExistingDraft(d: TaskAiExistingDraft | null | undefined): string {
  if (!d || (d.title == null && d.dueLocal == null && d.dueRepeat === undefined)) {
    return "(none — user has not filled the panel yet)";
  }
  const title = d.title?.trim() ? JSON.stringify(d.title.trim()) : '""';
  const due = d.dueLocal?.trim() ? JSON.stringify(d.dueLocal.trim()) : '""';
  const rep = d.dueRepeat == null ? "null" : JSON.stringify(d.dueRepeat);
  return `title=${title} dueLocal=${due} dueRepeat=${rep}`;
}

export function buildTaskFillUserTurn(body: TaskAiFillRequestBody, currentUserId: string): string {
  const { prompt, context } = body;
  const memberLines = context.members
    .map((m) => `- userId=${m.userId} name="${m.name.replace(/"/g, "'")}" email=${m.email}`)
    .join("\n");

  const draft = formatExistingDraft(context.existingDraft ?? undefined);

  return `MEMBER ROSTER (only valid assigneeUserIds are userId values listed here):
${memberLines || "(none — do not output assigneeUserIds)"}

TIME_ZONE: ${context.timeZone}
NOW_ISO (UTC reference for "today", "tomorrow", "next Friday"): ${context.nowIso}
CURRENT_USER_ID (for "me" / "myself"): ${currentUserId}

CURRENT_FORM_DRAFT (panel state before this message — user may fully replace or partially tweak):
${draft}

USER_MESSAGE:
${prompt.trim()}`;
}
