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
export type TaskRow = {
  id: string;
  title: string;
  status: string;
  priority?: string;
  dueAt: string | null;
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
