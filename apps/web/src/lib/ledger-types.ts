export type Org = { id: string; name: string; slug?: string; timeZone: string };
export type Dept = { id: string; name: string; organizationId: string; orderIndex: number };
export type ListRow = {
  id: string;
  name: string;
  organizationId: string;
  departmentId: string;
  orderIndex: number;
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

/** Permanent tombstone row from the Deletion log (owner-only) — survives independent of activity_ledger. */
export type DeletionLogEntry = {
  id: string;
  entityType: "task" | "list" | "department" | "organization" | "goal" | "milestone" | "discord_integration";
  entityId: string;
  organizationId: string;
  actorId: string;
  snapshot: Record<string, unknown>;
  createdAt: string;
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
  /** When a Discord channel is set, whether a Discord submission is required to mark this task done; defaults true server-side. */
  discordSubmissionRequired?: boolean;
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
  /** Set when status transitions to `done`; cleared if moved away from `done`. Compare to `dueAt` for on-time/late. */
  completedAt?: string | null;
  /** Set on the most recent successful Discord submission; independent of completion. */
  lastSubmittedAt?: string | null;
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
    /** Restore/purge only ever apply to an already-archived task (see the Archived page). */
    canRestoreTask: boolean;
    canPurgeTask: boolean;
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

export type RoadmapStatus = "on_track" | "at_risk" | "done" | "archived";

/** An outcome a team is pursuing; not time-boxed. Owns one or more milestones. */
export type GoalRow = {
  id: string;
  organizationId: string;
  departmentId: string | null;
  title: string;
  description: string | null;
  ownerId: string | null;
  status: RoadmapStatus;
  /** Soft overall deadline; not a structural boundary for its milestones. */
  targetDate: string | null;
  createdAt: string;
  updatedAt: string;
  /** Rollup across every milestone under this goal (root milestones' subtrees). */
  progress: { done: number; total: number; pct: number };
};

/** A time-boxed step serving a goal; free-form dates, no forced period ladder. Optionally self-nests via parentId. */
export type MilestoneRow = {
  id: string;
  organizationId: string;
  departmentId: string | null;
  goalId: string;
  parentId: string | null;
  title: string;
  description: string | null;
  periodStart: string;
  periodEnd: string;
  ownerId: string | null;
  status: RoadmapStatus;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
  /** Real tasks linked directly to this milestone (not including sub-milestones'). */
  linkedTaskIds: string[];
  /** Bottom-up rollup: own linked tasks + all sub-milestones' linked tasks. */
  progress: { done: number; total: number; pct: number };
};

/** `GET /organizations/:id/activity` — ledger rows for tasks visible to the user (newest first). */
export type OrgActivityTaskMeta = { id: string; title: string; assignerId: string; dueAt: string | null };
export type OrgActivityLedgerRow = LedgerRow & { taskId: string };
export type OrgActivityFeedResponse = {
  entries: OrgActivityLedgerRow[];
  tasksById: Record<string, OrgActivityTaskMeta>;
  /** Assignees for tasks referenced in `entries` (authoritative for notification eligibility). */
  assigneesByTaskId: Record<string, string[]>;
};

/** `GET /organizations/:id/performance/scorecards` — per-person rollup, owner/manager-gated. */
export type PerformanceScorecardRow = {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  completed: number;
  onTime: number;
  /** Completed after their due date. */
  late: number;
  onTimeRate: number;
  pending: number;
  inProgress: number;
  /** Still open (pending/in-progress) and past their due date. */
  latePending: number;
  lateInProgress: number;
  openAssigned: number;
  timeLoggedSeconds: number;
  /** Discord submission required *and* a channel was actually configured. */
  submissionsRequired: number;
  submissionsFulfilled: number;
  submissionRate: number;
  /** Discord channel configured but submission not mandatory — never counted against compliance. */
  submissionsOptional: number;
  submissionsOptionalFulfilled: number;
  attachmentsRequired: number;
  attachmentsFulfilled: number;
  attachmentRate: number;
};
export type PerformanceScorecardsResponse = {
  members: PerformanceScorecardRow[];
  totals: Omit<PerformanceScorecardRow, "userId" | "name" | "email" | "image" | "role">;
  dateFrom: string;
  dateTo: string;
};

/**
 * `GET /organizations/:id/performance/scorecards/:userId/tasks` — one member's task drill-down.
 * A completed recurring task with 2+ occurrences in range collapses into one "collection" row
 * (`occurrenceCount` set) instead of listing each cycle separately.
 */
export type MemberTaskRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  listId: string;
  dueAt: string | null;
  completedAt: string | null;
  late: boolean;
  discordChannelId: string | null;
  discordSubmissionRequired: boolean;
  lastSubmittedAt: string | null;
  attachmentRequired: boolean;
  hasAttachment: boolean;
  timeLoggedSeconds: number;
  occurrenceCount?: number;
  lateCount?: number;
  submissionsRequiredCount?: number;
  submissionsFulfilledCount?: number;
  attachmentsRequiredCount?: number;
  attachmentsFulfilledCount?: number;
};
