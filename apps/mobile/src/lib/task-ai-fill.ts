import { AUTH_URL } from '@/lib/config';
import { authClient } from '@/lib/auth-client';
import type { ManualTaskStatus, TaskPriority } from '@/lib/task-board';
import type { MemberRow, TaskDueRepeat } from '@/lib/types';

/** Mirror of the web's `TaskAiFillResult` (`/api/ai/task-fill`): `null` = leave that field unchanged. */
export type TaskAiFillResult = {
  title: string | null;
  subtasks: string[] | null;
  assigneeUserIds: string[] | null;
  status: ManualTaskStatus | null;
  priority: TaskPriority | null;
  /** `null` unchanged; `""` clear; else local `YYYY-MM-DDTHH:mm`. */
  dueLocal: string | null;
  /** `null` unchanged; `"none"` clear; else cadence. */
  dueRepeat: TaskDueRepeat | 'none' | null;
};

export type TaskAiExistingDraft = { title?: string; dueLocal?: string; dueRepeat?: TaskDueRepeat | null };

const pad = (n: number) => String(n).padStart(2, '0');

/** A due date in the web's picker format (`YYYY-MM-DDTHH:mm`, device-local). */
export function toDueLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The web's task-fill endpoint authenticates with the session cookie, which lives in SecureStore. */
export async function requestTaskAiFill(
  prompt: string,
  members: MemberRow[],
  existingDraft: TaskAiExistingDraft,
): Promise<TaskAiFillResult> {
  const cookie = authClient.getCookie();
  let res: Response;
  try {
    res = await fetch(`${AUTH_URL}/api/ai/task-fill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      credentials: 'omit',
      body: JSON.stringify({
        prompt,
        context: {
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          nowIso: new Date().toISOString(),
          members: members.map((m) => ({ userId: m.userId, name: m.name, email: m.email })),
          existingDraft,
        },
      }),
    });
  } catch {
    throw new Error("Can't reach the server. Check your connection.");
  }
  const json = (await res.json().catch(() => ({}))) as { result?: TaskAiFillResult; error?: string };
  if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : res.statusText || 'Request failed');
  if (!json.result) throw new Error('Unexpected response');
  return json.result;
}

const LABELS: [keyof TaskAiFillResult, string][] = [
  ['title', 'Title'],
  ['subtasks', 'Subtasks'],
  ['assigneeUserIds', 'Assignees'],
  ['dueLocal', 'Due date'],
  ['dueRepeat', 'Recurrence'],
  ['status', 'Status'],
  ['priority', 'Priority'],
];

export function aiFillSummary(r: TaskAiFillResult): string {
  const applied = LABELS.filter(([k]) => r[k] !== null).map(([, l]) => l);
  return applied.length ? `Filled: ${applied.join(', ')}.` : 'Done.';
}
