import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, inArray, isNull, max } from "drizzle-orm";
import {
  activityLedger,
  lists,
  organizationMemberManagedDepartments,
  organizationMembers,
  subtasks,
  taskAssignees,
  tasks,
} from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { DRIZZLE } from "../db/drizzle.constants";

export type TaskAccess = {
  task: typeof tasks.$inferSelect;
  role: "owner" | "manager" | "member" | "assignee_only";
  isOwner: boolean;
  isDeptManager: boolean;
  isAssignee: boolean;
};

@Injectable()
export class AuthorizationService {
  constructor(@Inject(DRIZZLE) private readonly db: AppDatabase) {}

  /** Levels a manager may access; falls back to legacy `organization_members.department_id`. */
  private async managedDepartmentIdsForMember(
    membershipId: string,
    role: string,
    legacyDepartmentId: string | null,
  ): Promise<string[]> {
    if (role !== "manager") return [];
    const rows = await this.db
      .select({ departmentId: organizationMemberManagedDepartments.departmentId })
      .from(organizationMemberManagedDepartments)
      .where(eq(organizationMemberManagedDepartments.organizationMemberId, membershipId));
    const fromJunction = rows.map((r) => r.departmentId);
    if (fromJunction.length > 0) return fromJunction;
    return legacyDepartmentId ? [legacyDepartmentId] : [];
  }

  async assertOrgMember(userId: string, organizationId: string) {
    const row = await this.db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, userId),
        ),
      )
      .limit(1);
    if (row.length === 0) {
      throw new ForbiddenException("Not a member of this organization");
    }
    return row[0]!;
  }

  async getTaskAccess(userId: string, taskId: string): Promise<TaskAccess> {
    const taskRows = await this.db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    if (taskRows.length === 0) throw new NotFoundException("Task not found");
    const task = taskRows[0]!;
    const listRows = await this.db.select().from(lists).where(eq(lists.id, task.listId)).limit(1);
    if (listRows.length === 0) throw new NotFoundException("Task list not found");
    const list = listRows[0]!;

    const [assigneeRows, memberRows] = await Promise.all([
      this.db
        .select()
        .from(taskAssignees)
        .where(and(eq(taskAssignees.taskId, taskId), eq(taskAssignees.userId, userId)))
        .limit(1),
      this.db
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, task.organizationId),
            eq(organizationMembers.userId, userId),
          ),
        )
        .limit(1),
    ]);
    const isAssignee = assigneeRows.length > 0;
    const membership = memberRows[0];

    const isOwner = membership?.role === "owner";
    const managedDeptIds = membership
      ? await this.managedDepartmentIdsForMember(
          membership.id,
          membership.role,
          membership.departmentId,
        )
      : [];
    const isDeptManager =
      membership?.role === "manager" && managedDeptIds.includes(list.departmentId);

    const canParticipate = isOwner || isDeptManager || isAssignee;
    if (!canParticipate) {
      throw new ForbiddenException("No access to this task");
    }

    const role: TaskAccess["role"] = isOwner
      ? "owner"
      : isDeptManager
        ? "manager"
        : membership
          ? "member"
          : "assignee_only";

    return { task, role, isOwner, isDeptManager, isAssignee };
  }

  taskCapabilities(access: TaskAccess, userId: string) {
    const t = access.task;
    const isAssigner = t.assignerId === userId;
    const active = t.deletedAt == null;
    return {
      canDeleteTask: isAssigner && active,
      canReschedule: active && (access.isOwner || access.isDeptManager || access.isAssignee),
      canAppendLedger: active && (access.isOwner || access.isDeptManager || access.isAssignee),
    };
  }

  async listOrganizationIdsForUser(userId: string): Promise<string[]> {
    const [fromMembers, fromAssignees] = await Promise.all([
      this.db
        .selectDistinct({ id: organizationMembers.organizationId })
        .from(organizationMembers)
        .where(eq(organizationMembers.userId, userId)),
      this.db
        .selectDistinct({ id: tasks.organizationId })
        .from(taskAssignees)
        .innerJoin(tasks, eq(taskAssignees.taskId, tasks.id))
        .where(eq(taskAssignees.userId, userId)),
    ]);

    const set = new Set<string>();
    for (const r of fromMembers) set.add(r.id);
    for (const r of fromAssignees) set.add(r.id);
    return [...set];
  }

  async listTasksForUser(
    userId: string,
    organizationId: string,
    opts?: { includeSubtasks?: boolean },
  ) {
    const includeSubtasks = opts?.includeSubtasks !== false;

    const orgIds = await this.listOrganizationIdsForUser(userId);
    if (!orgIds.includes(organizationId)) {
      throw new ForbiddenException("No access to this organization");
    }

    const memberRow = await this.db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, userId),
        ),
      )
      .limit(1);
    const m = memberRow[0];

    if (m?.role === "owner") {
      const ownerRows = await this.db
        .select()
        .from(tasks)
        .where(and(eq(tasks.organizationId, organizationId), isNull(tasks.deletedAt)));
      return this.finalizeTaskList(ownerRows, includeSubtasks);
    }

    if (m?.role === "manager") {
      const managedDeptIds = await this.managedDepartmentIdsForMember(m.id, m.role, m.departmentId);
      if (managedDeptIds.length === 0) return [];
      const managerLists = await this.db
        .select()
        .from(lists)
        .where(
          and(eq(lists.organizationId, organizationId), inArray(lists.departmentId, managedDeptIds)),
        );
      if (managerLists.length === 0) return [];
      const managerRows = await this.db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.organizationId, organizationId),
            inArray(
              tasks.listId,
              managerLists.map((x) => x.id),
            ),
            isNull(tasks.deletedAt),
          ),
        );
      return this.finalizeTaskList(managerRows, includeSubtasks);
    }

    const assignedTaskIds = await this.db
      .select({ taskId: taskAssignees.taskId })
      .from(taskAssignees)
      .innerJoin(tasks, eq(taskAssignees.taskId, tasks.id))
      .where(
        and(
          eq(taskAssignees.userId, userId),
          eq(tasks.organizationId, organizationId),
          isNull(tasks.deletedAt),
        ),
      );

    const ids = assignedTaskIds.map((r) => r.taskId);
    if (ids.length === 0) return [];

    const assigneeOnlyRows = await this.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.organizationId, organizationId), inArray(tasks.id, ids)));
    return this.finalizeTaskList(assigneeOnlyRows, includeSubtasks);
  }

  /** Assignees always attached; subtasks loaded only when needed (saves a batched subtask query). */
  private async finalizeTaskList(taskRows: (typeof tasks.$inferSelect)[], includeSubtasks: boolean) {
    const withAssignees = await this.attachAssigneeUserIds(taskRows);
    const withLedger = await this.attachLastLedger(withAssignees);
    if (!includeSubtasks) return withLedger;
    return this.attachSubtasks(withLedger);
  }

  /** Adds assigneeUserIds to each task for list/board views (names resolved client-side from members). */
  private async attachAssigneeUserIds(taskRows: (typeof tasks.$inferSelect)[]) {
    if (taskRows.length === 0) return [];
    const ids = taskRows.map((t) => t.id);
    const assignRows = await this.db
      .select({ taskId: taskAssignees.taskId, userId: taskAssignees.userId })
      .from(taskAssignees)
      .where(inArray(taskAssignees.taskId, ids));
    const map = new Map<string, string[]>();
    for (const r of assignRows) {
      const prev = map.get(r.taskId);
      if (prev) prev.push(r.userId);
      else map.set(r.taskId, [r.userId]);
    }
    return taskRows.map((t) => ({
      ...t,
      assigneeUserIds: map.get(t.id) ?? [],
    }));
  }

  /** Newest ledger row per task for list/kanban preview (single join + group). */
  private async attachLastLedger<T extends { id: string }>(taskRows: T[]) {
    if (taskRows.length === 0) return [];
    const ids = taskRows.map((t) => t.id);

    const latestSq = this.db
      .select({
        taskId: activityLedger.taskId,
        maxCreated: max(activityLedger.createdAt).as("max_created"),
      })
      .from(activityLedger)
      .where(inArray(activityLedger.taskId, ids))
      .groupBy(activityLedger.taskId)
      .as("ledger_latest");

    const rows = await this.db
      .select({ ledger: activityLedger })
      .from(activityLedger)
      .innerJoin(
        latestSq,
        and(eq(activityLedger.taskId, latestSq.taskId), eq(activityLedger.createdAt, latestSq.maxCreated)),
      );

    const map = new Map<string, (typeof activityLedger.$inferSelect)>();
    for (const r of rows) {
      map.set(r.ledger.taskId, r.ledger);
    }

    return taskRows.map((t) => ({
      ...t,
      lastLedger: map.get(t.id) ?? null,
    }));
  }

  /** Batches subtasks for list/board views (newest first per task, same as listSubtasks). */
  private async attachSubtasks<T extends { id: string }>(taskRows: T[]) {
    if (taskRows.length === 0) return [];
    const ids = taskRows.map((t) => t.id);
    const subRows = await this.db
      .select()
      .from(subtasks)
      .where(inArray(subtasks.taskId, ids));
    const map = new Map<string, (typeof subtasks.$inferSelect)[]>();
    for (const r of subRows) {
      const arr = map.get(r.taskId);
      if (arr) arr.push(r);
      else map.set(r.taskId, [r]);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    return taskRows.map((t) => ({
      ...t,
      subtasks: map.get(t.id) ?? [],
    }));
  }
}
