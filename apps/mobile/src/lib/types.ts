/** API response shapes used by the app. Mirrors `apps/web/src/lib/ledger-types.ts`. */

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
  departmentId: string | null;
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
  createdAt?: string;
  updatedAt?: string;
};

export type LedgerRow = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  actorId: string;
  createdAt: string;
  clientMutationId?: string | null;
};

export type TaskDueRepeat = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type TaskRow = {
  id: string;
  title: string;
  status: string;
  priority?: string;
  dueAt: string | null;
  dueRepeat?: TaskDueRepeat | null;
  recurringSeriesId?: string | null;
  discordChannelId?: string | null;
  discordSubmissionRequired?: boolean;
  attachmentRequired?: boolean;
  timeTrackingEnabled?: boolean;
  listId: string;
  assignerId: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt: string | null;
  completedAt?: string | null;
  lastSubmittedAt?: string | null;
  assigneeUserIds?: string[];
  subtasks?: SubtaskRow[];
  lastLedger?: LedgerRow | null;
};

export type TaskCapabilities = {
  canArchiveTask: boolean;
  canRestoreTask?: boolean;
  canPurgeTask?: boolean;
  /** Title, priority, due date, assignees, checklist add/edit/delete. */
  canEditFields: boolean;
  /** Status change, subtask toggle, comments, attachments. */
  canParticipate: boolean;
};

export type TaskDetail = {
  task: TaskRow;
  capabilities: TaskCapabilities;
  assigneeUserIds: string[];
  subtasks: SubtaskRow[];
  ledger: LedgerRow[];
};

export type TaskMutationResult = {
  task: TaskRow;
  capabilities: TaskCapabilities;
  assigneeUserIds: string[];
  subtasks: SubtaskRow[];
  ledgerDelta: LedgerRow[];
  spawnedRecurringTaskId?: string;
};

export type TaskPage = { tasks: TaskRow[]; nextCursor: string | null; total?: number };

export type WorkspaceBootstrap = { departments: Dept[]; lists: ListRow[]; members: MemberRow[] };
