export type Org = { id: string; name: string; slug?: string };
export type Dept = { id: string; name: string; organizationId: string };
export type ListRow = {
  id: string;
  name: string;
  organizationId: string;
  departmentId: string;
};
export type MemberRow = {
  userId: string;
  role: string;
  /** First managed level (legacy / convenience); use `managedDepartmentIds` for full set. */
  departmentId: string | null;
  /** Levels this manager covers; empty when not a manager. */
  managedDepartmentIds: string[];
  email: string;
  name: string;
  image?: string | null;
};
export type SubtaskRow = {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TaskDueRepeat = "daily" | "weekly" | "monthly" | "yearly";

export function parseTaskDueRepeat(v: unknown): TaskDueRepeat | null {
  if (v == null || v === "") return null;
  const s = String(v);
  if (s === "daily" || s === "weekly" || s === "monthly" || s === "yearly") return s;
  return null;
}

export type LedgerRow = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  actorId: string;
  createdAt: string;
  clientMutationId: string | null;
};

export type TaskRow = {
  id: string;
  title: string;
  status: string;
  priority?: string;
  /** Single due instant (ISO 8601); includes time; `null` if unset. */
  dueAt: string | null;
  /** Cadence after due; `null` / omitted = none. */
  dueRepeat?: TaskDueRepeat | null;
  /** Recurring chain grouping id (set when `dueRepeat` is active). */
  recurringSeriesId?: string | null;
  /** Parent task id when this row was spawned as the next recurrence cycle. */
  spawnedFromTaskId?: string | null;
  /** Discord channel snowflake ID attachments post to; `null`/omitted = Discord posting disabled. */
  discordChannelId?: string | null;
  /** At least one attachment (any source) is required to mark this task done. */
  attachmentRequired?: boolean;
  /** Controls whether the time-tracking UI renders for this task; defaults true server-side. */
  timeTrackingEnabled?: boolean;
  listId: string;
  assignerId: string;
  /** ISO timestamps from API detail/list (`Date` serialized). */
  createdAt?: string;
  updatedAt?: string;
  deletedAt: string | null;
  /** Present on organization task list responses; resolved from task assignees. */
  assigneeUserIds?: string[];
  /** On workspace bootstrap and list APIs when subtasks are included (batched on the server). */
  subtasks?: SubtaskRow[];
  /** Newest ledger row for list/kanban footer; omitted or null when no activity stored yet. */
  lastLedger?: LedgerRow | null;
};

export type TaskDetail = {
  task: TaskRow;
  capabilities: {
    canArchiveTask: boolean;
    canDeleteTask: boolean;
    /** Structural/scope edits: title, priority, due/recurrence, assignees, subtask add/edit/delete. */
    canEditFields: boolean;
    /** Status change, subtask toggle, comments, attachments, Discord submit, dependencies, time log. */
    canParticipate: boolean;
  };
  assigneeUserIds: string[];
  subtasks: SubtaskRow[];
  ledger: LedgerRow[];
};

/** Response from `POST …/tasks`, `PATCH /tasks/:id`, reschedule, archive — no full ledger. */
export type TaskMutationResult = {
  task: TaskRow;
  capabilities: TaskDetail["capabilities"];
  assigneeUserIds: string[];
  subtasks: SubtaskRow[];
  ledgerDelta: LedgerRow[];
  /** Present when completing a recurring task created the next occurrence. */
  spawnedRecurringTaskId?: string;
};

export type DiscordChannelOption = { id: string; name: string; position: number; isPrivate: boolean };

export type RoadmapPeriod = "yearly" | "quarterly" | "monthly" | "weekly";
export type RoadmapStatus = "on_track" | "at_risk" | "done" | "archived";

/** A planning goal (Year → Quarter → Month → Week) with rollup progress computed server-side. */
export type RoadmapItemRow = {
  id: string;
  organizationId: string;
  departmentId: string | null;
  parentId: string | null;
  period: RoadmapPeriod;
  title: string;
  description: string | null;
  periodStart: string;
  periodEnd: string;
  ownerId: string | null;
  status: RoadmapStatus;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
  /** Real tasks linked directly to this goal (not including descendants'). */
  linkedTaskIds: string[];
  /** Bottom-up rollup: own linked tasks + all descendant goals' linked tasks. */
  progress: { done: number; total: number; pct: number };
};

/** `GET /organizations/:id/activity` — ledger rows for tasks visible to the user (newest first). */
export type OrgActivityTaskMeta = { id: string; title: string; assignerId: string };
export type OrgActivityLedgerRow = LedgerRow & { taskId: string };
export type OrgActivityFeedResponse = {
  entries: OrgActivityLedgerRow[];
  tasksById: Record<string, OrgActivityTaskMeta>;
  /** Assignees for tasks referenced in `entries` (authoritative for notification eligibility). */
  assigneesByTaskId: Record<string, string[]>;
};
