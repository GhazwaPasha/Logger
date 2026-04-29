export type Org = { id: string; name: string };
export type Dept = { id: string; name: string; organizationId: string };
export type MemberRow = {
  userId: string;
  role: string;
  departmentId: string | null;
  email: string;
  name: string;
};
export type TaskRow = {
  id: string;
  title: string;
  status: string;
  dueAt: string | null;
  departmentId: string;
  assignerId: string;
  deletedAt: string | null;
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
  ledger: LedgerRow[];
};
