# Task AI fill — playbook

Canonical **machine** copy lives in code: `apps/web/src/lib/task-ai-playbook.ts` (`TASK_AI_SYSTEM_INSTRUCTION`, `GEMINI_TASK_FILL_RESPONSE_SCHEMA`, `buildTaskFillUserTurn`). Update that file when product rules change; use this doc for a human-readable overview.

## What the feature may set

Aligned with workspace task **create / edit** forms and API contracts (`createTaskSchema`, `patchTaskSchema` in `@work-ledger/contracts`).

The API returns a **fixed object** with **all seven keys always present** (`TaskAiFillResult`). **`JSON null`** on a key means **leave that form field unchanged**. Other sentinels:

| Output key | Type | Meaning |
|------------|------|--------|
| `title` | `string \| null` | `null` = unchanged; string = short task name only (not full user text). |
| `subtasks` | `string[] \| null` | `null` = unchanged; `[]` = clear draft subtasks; non-empty = set lines (edit: replaces “new” draft lines when `[]`). |
| `assigneeUserIds` | `string[] \| null` | `null` = unchanged; `[]` = clear assignees; else roster ids (server filters). |
| `status` | enum \| `null` | `null` = unchanged. |
| `priority` | enum \| `null` | `null` = unchanged. |
| `dueLocal` | `string \| null` | `null` = unchanged; `""` = clear due; else `YYYY-MM-DDTHH:mm` local. |
| `dueRepeat` | cadence \| `"none"` \| `null` | `null` = unchanged; `"none"` = clear repeat; else `daily` \| … |

## Out of scope for this step

Do **not** ask the model for: `listId`, departments, ledger, attachments, comments, or automation flags. List / level scope comes from the **URL / UI**, not natural language in this panel.

## Runtime behavior

- **Route:** `apps/web/src/app/api/ai/task-fill/route.ts` — Gemini `generateContent` with `responseMimeType: application/json` + `responseSchema`, then **`extractJsonObjectFromModelText`** (`apps/web/src/lib/task-ai-json.ts`) if the model still wraps JSON in fences or prose.
- **Normalize:** `apps/web/src/lib/task-ai-fill.ts` — **`normalizeTaskAiFillPayload`** builds the full `TaskAiFillResult` (all keys); clamps enums and roster ids; accepts alternate repeat keys (`repeat`, `recurrence`, `repeatCadence`) and **`parseDueRepeatLoose`** for cadence strings.
- **Client context:** `TaskPanelAiFill` sends **`context.existingDraft`** (`title`, `dueLocal`, `dueRepeat`) so the model can set **`dueRepeat`** when the user only says “repeat weekly” and the due is already on the panel, and can **override** the draft when the user describes a new task (see system instructions in `task-ai-playbook.ts`).

## Ops / model

- **Env (repo root, loaded into Next):** `GEMINI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY`; optional `GEMINI_MODEL`. If `GEMINI_MODEL` is unset, the server picks the first `generateContent`-capable model from `models.list` (cached).
