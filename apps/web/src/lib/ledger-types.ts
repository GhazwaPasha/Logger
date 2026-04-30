export type Org = { id: string; name: string };
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
  departmentId: string | null;
  email: string;
  name: string;
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

export type TaskRow = {
  id: string;
  title: string;
  status: string;
  priority?: string;
  /** Single due instant (ISO 8601); includes time; `null` if unset. */
  dueAt: string | null;
  /** Cadence after due; `null` / omitted = none. */
  dueRepeat?: TaskDueRepeat | null;
  listId: string;
  assignerId: string;
  deletedAt: string | null;
  /** Present on organization task list responses; resolved from task assignees. */
  assigneeUserIds?: string[];
  /** Present on organization task list responses; avoids per-task subtask fetches. */
  subtasks?: SubtaskRow[];
};
export type LedgerRow = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  actorId: string;
  createdAt: string;
  clientMutationId: string | null;
};
export type TaskDetail = {
  task: TaskRow;
  capabilities: { canDeleteTask: boolean; canReschedule: boolean; canAppendLedger: boolean };
  assigneeUserIds: string[];
  subtasks: SubtaskRow[];
  ledger: LedgerRow[];
};
