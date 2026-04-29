/**
 * Domain hierarchy (persisted in DB as organizations → departments → tasks).
 * Users may call these anything; we expose neutral "node" language in copy where helpful.
 *
 * - Node 1 (workspace): `organizations` row — many per user.
 * - Node 2 (level): `departments` row — many per workspace.
 * - Node 3 (work item): `tasks` row — many per level; checklists/subtasks can extend this later.
 */

export const NODE_LABELS = {
  workspace: "Workspace",
  level: "Level",
  workItem: "Work item",
} as const;

/** API path still uses `organizationId`; in UI we call it workspaceId. */
export type WorkspaceId = string;
export type LevelId = string;
export type WorkItemId = string;
