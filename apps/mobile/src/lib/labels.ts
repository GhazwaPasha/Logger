import { normalizeTaskStatus, PRIORITY_LABELS, STATUS_LABELS, type TaskPriority } from '@/lib/task-board';

/** Display label for any stored status value (including legacy ones). */
export const statusLabelOf = (s: unknown): string => STATUS_LABELS[normalizeTaskStatus(String(s ?? ''))];

export const priorityLabelOf = (p: unknown): string => PRIORITY_LABELS[p as TaskPriority] ?? String(p ?? '');

/** UI copy for the org hierarchy (`NODE_LABELS` in `apps/web/src/lib/nodes.ts`). */
export const NODE_LABELS = {
  workspace: 'Workspace',
  level: 'Category',
  levelPlural: 'Categories',
  list: 'Channel',
  listPlural: 'Channels',
  workItem: 'Task',
} as const;
