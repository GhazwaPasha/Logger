/**
 * Domain hierarchy (persisted in DB as organizations → departments → lists → tasks → subtasks).
 * Users may call these anything; we expose neutral "node" language in copy where helpful.
 *
 * - Node 1 (workspace): `organizations` row — many per user.
 * - Node 2 (level): `departments` row — many per workspace.
 * - Node 3 (list): `lists` row — many per level.
 * - Node 4 (task): `tasks` row — many per list.
 * - Node 5 (subtask, optional): `subtasks` row — many per task.
 */

export const NODE_LABELS = {
  workspace: "Workspace",
  level: "Level",
  workItem: "Task",
} as const;

/** API path still uses `organizationId`; in UI we call it workspaceId. */
export type WorkspaceId = string;
export type LevelId = string;
export type WorkItemId = string;
