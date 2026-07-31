import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { type SQL, and, count, desc, eq, gte, inArray, isNull, lt, lte, max, or } from "drizzle-orm";
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

export interface ListTasksOpts {
  includeSubtasks?: boolean;
  status?: string[];
  listId?: string;
  departmentId?: string;
  assigneeUserId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  limit?: number;
  cursor?: string;
}

function encodeCursor(task: { createdAt: Date; id: string }): string {
  return Buffer.from(JSON.stringify({ createdAt: task.createdAt.toISOString(), id: task.id })).toString("base64url");
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const raw = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      createdAt: string;
      id: string;
    };
    return { createdAt: new Date(raw.createdAt), id: raw.id };
  } catch {
    return null;
  }
}

export type TaskAccess = {
  task: typeof tasks.$inferSelect;
  role: "owner" | "manager" | "member" | "assignee_only";
  isOwner: boolean;
  isDeptManager: boolean;
  isAssignee: boolean;
  isAssigner: boolean;
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

  /** Public wrapper for callers outside task access (e.g. RoadmapService) that need a member's managed levels. */
  async managedDepartmentIdsForUser(userId: string, organizationId: string): Promise<string[]> {
    const rows = await this.db
      .select()
      .from(organizationMembers)
      .where(
        and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, userId)),
      )
      .limit(1);
    const m = rows[0];
    if (!m) return [];
    return this.managedDepartmentIdsForMember(m.id, m.role, m.departmentId);
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

  /** Membership plus an owner-role check, for owner-only actions (billing, integrations, org deletion). */
  async assertOrgOwner(userId: string, organizationId: string) {
    const membership = await this.assertOrgMember(userId, organizationId);
    if (membership.role !== "owner") {
      throw new ForbiddenException("Only owners can perform this action");
    }
    return membership;
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
    const isAssigner = task.assignerId === userId;
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

    const canParticipate = isOwner || isDeptManager || isAssignee || isAssigner;
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

    return { task, role, isOwner, isDeptManager, isAssignee, isAssigner };
  }

  taskCapabilities(access: TaskAccess, userId: string) {
    const t = access.task;
    const active = t.deletedAt == null;
    /** Managers archive tasks in their levels; owners and creators use delete (same soft-delete endpoint). */
    const isAssigner = access.isAssigner;
    const canArchiveTask = active && access.isDeptManager && !access.isOwner;
    const canDeleteTask = active && (access.isOwner || isAssigner);
    /** Structural/scope edits: title, priority, due/recurrence, assignees, subtask add/edit/delete. */
    const canEditFields = active && (access.isOwner || access.isDeptManager || isAssigner);
    /** Status change, subtask toggle, comments, attachments, Discord submit, dependencies, time log — any participant while active. */
    const canParticipate = active;
    return {
      canArchiveTask,
      canDeleteTask,
      canEditFields,
      canParticipate,
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

  /** Fast ID-only list for internal callers (activity feed, search). No filters or pagination. */
  async listTaskIdsForUser(userId: string, organizationId: string): Promise<string[]> {
    const orgIds = await this.listOrganizationIdsForUser(userId);
    if (!orgIds.includes(organizationId)) {
      throw new ForbiddenException("No access to this organization");
    }

    const memberRow = await this.db
      .select()
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, userId)))
      .limit(1);
    const m = memberRow[0];

    if (m?.role === "owner") {
      const rows = await this.db
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.organizationId, organizationId), isNull(tasks.deletedAt)));
      return rows.map((r) => r.id);
    }

    if (m?.role === "manager") {
      const managedDeptIds = await this.managedDepartmentIdsForMember(m.id, m.role, m.departmentId);
      if (managedDeptIds.length === 0) return [];
      const managerLists = await this.db
        .select({ id: lists.id })
        .from(lists)
        .where(and(eq(lists.organizationId, organizationId), inArray(lists.departmentId, managedDeptIds)));
      if (managerLists.length === 0) return [];
      const rows = await this.db
        .select({ id: tasks.id })
        .from(tasks)
        .where(
          and(
            eq(tasks.organizationId, organizationId),
            inArray(tasks.listId, managerLists.map((l) => l.id)),
            isNull(tasks.deletedAt),
          ),
        );
      return rows.map((r) => r.id);
    }

    const assignedRows = await this.db
      .select({ taskId: taskAssignees.taskId })
      .from(taskAssignees)
      .innerJoin(tasks, eq(taskAssignees.taskId, tasks.id))
      .where(and(eq(taskAssignees.userId, userId), eq(tasks.organizationId, organizationId), isNull(tasks.deletedAt)));
    return assignedRows.map((r) => r.taskId);
  }

  async listTasksForUser(userId: string, organizationId: string, opts?: ListTasksOpts) {
    const includeSubtasks = opts?.includeSubtasks !== false;
    const limit = Math.min(opts?.limit ?? 50, 100);

    const orgIds = await this.listOrganizationIdsForUser(userId);
    if (!orgIds.includes(organizationId)) {
      throw new ForbiddenException("No access to this organization");
    }

    const memberRow = await this.db
      .select()
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, userId)))
      .limit(1);
    const m = memberRow[0];

    // Role-scoped base conditions
    const roleConditions: (SQL | undefined)[] = [
      eq(tasks.organizationId, organizationId),
      isNull(tasks.deletedAt),
    ];

    if (m?.role === "manager") {
      const managedDeptIds = await this.managedDepartmentIdsForMember(m.id, m.role, m.departmentId);
      if (managedDeptIds.length === 0) return { tasks: [], nextCursor: null, total: 0 };
      const managerLists = await this.db
        .select({ id: lists.id })
        .from(lists)
        .where(and(eq(lists.organizationId, organizationId), inArray(lists.departmentId, managedDeptIds)));
      if (managerLists.length === 0) return { tasks: [], nextCursor: null, total: 0 };
      roleConditions.push(inArray(tasks.listId, managerLists.map((l) => l.id)));
    } else if (!m || m.role === "member") {
      const assignedIds = await this.db
        .select({ taskId: taskAssignees.taskId })
        .from(taskAssignees)
        .innerJoin(tasks, eq(taskAssignees.taskId, tasks.id))
        .where(and(eq(taskAssignees.userId, userId), eq(tasks.organizationId, organizationId), isNull(tasks.deletedAt)));
      const ids = assignedIds.map((r) => r.taskId);
      if (ids.length === 0) return { tasks: [], nextCursor: null, total: 0 };
      roleConditions.push(inArray(tasks.id, ids));
    }

    // Filter conditions
    const filterConditions: (SQL | undefined)[] = [];

    if (opts?.status?.length) {
      filterConditions.push(inArray(tasks.status, opts.status as (typeof tasks.$inferSelect)["status"][]));
    }

    if (opts?.listId) {
      filterConditions.push(eq(tasks.listId, opts.listId));
    } else if (opts?.departmentId) {
      const deptLists = await this.db
        .select({ id: lists.id })
        .from(lists)
        .where(and(eq(lists.organizationId, organizationId), eq(lists.departmentId, opts.departmentId)));
      if (deptLists.length === 0) return { tasks: [], nextCursor: null, total: 0 };
      filterConditions.push(inArray(tasks.listId, deptLists.map((l) => l.id)));
    }

    if (opts?.assigneeUserId) {
      const assignedRows = await this.db
        .select({ taskId: taskAssignees.taskId })
        .from(taskAssignees)
        .where(eq(taskAssignees.userId, opts.assigneeUserId));
      const assignedIds = assignedRows.map((r) => r.taskId);
      if (assignedIds.length === 0) return { tasks: [], nextCursor: null, total: 0 };
      filterConditions.push(inArray(tasks.id, assignedIds));
    }

    if (opts?.dueDateFrom) filterConditions.push(gte(tasks.dueAt, new Date(opts.dueDateFrom)));
    if (opts?.dueDateTo) filterConditions.push(lte(tasks.dueAt, new Date(opts.dueDateTo)));

    const baseConditions = [...roleConditions, ...filterConditions];

    // Cursor (applied to SELECT only, not COUNT)
    const decoded = opts?.cursor ? decodeCursor(opts.cursor) : null;
    const cursorCondition = decoded
      ? or(lt(tasks.createdAt, decoded.createdAt), and(eq(tasks.createdAt, decoded.createdAt), lt(tasks.id, decoded.id)))
      : undefined;

    const selectConditions = cursorCondition ? [...baseConditions, cursorCondition] : baseConditions;

    const [countRows, pageRows] = await Promise.all([
      this.db.select({ value: count() }).from(tasks).where(and(...baseConditions)),
      this.db
        .select()
        .from(tasks)
        .where(and(...selectConditions))
        .orderBy(desc(tasks.createdAt), desc(tasks.id))
        .limit(limit + 1),
    ]);

    const total = Number(countRows[0]?.value ?? 0);
    const hasMore = pageRows.length > limit;
    const slicedRows = hasMore ? pageRows.slice(0, limit) : pageRows;
    const nextCursor =
      hasMore && slicedRows.length > 0 ? encodeCursor(slicedRows[slicedRows.length - 1]!) : null;

    const finalized = await this.finalizeTaskList(slicedRows, includeSubtasks);
    return { tasks: finalized, nextCursor, total };
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

  /** Batches subtasks for list/board views (oldest first per task, same as listSubtasks). */
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
      arr.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }
    return taskRows.map((t) => ({
      ...t,
      subtasks: map.get(t.id) ?? [],
    }));
  }
}
