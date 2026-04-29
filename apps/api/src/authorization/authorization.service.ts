import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { organizationMembers, taskAssignees, tasks } from "@work-ledger/db";
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

    const assigneeRows = await this.db
      .select()
      .from(taskAssignees)
      .where(and(eq(taskAssignees.taskId, taskId), eq(taskAssignees.userId, userId)))
      .limit(1);
    const isAssignee = assigneeRows.length > 0;

    const memberRows = await this.db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, task.organizationId),
          eq(organizationMembers.userId, userId),
        ),
      )
      .limit(1);
    const membership = memberRows[0];

    const isOwner = membership?.role === "owner";
    const isDeptManager =
      membership?.role === "manager" && membership.departmentId === task.departmentId;

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
    const fromMembers = await this.db
      .selectDistinct({ id: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, userId));

    const fromAssignees = await this.db
      .selectDistinct({ id: tasks.organizationId })
      .from(taskAssignees)
      .innerJoin(tasks, eq(taskAssignees.taskId, tasks.id))
      .where(eq(taskAssignees.userId, userId));

    const set = new Set<string>();
    for (const r of fromMembers) set.add(r.id);
    for (const r of fromAssignees) set.add(r.id);
    return [...set];
  }

  async listTasksForUser(userId: string, organizationId: string) {
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
      return this.db
        .select()
        .from(tasks)
        .where(and(eq(tasks.organizationId, organizationId), isNull(tasks.deletedAt)));
    }

    if (m?.role === "manager" && m.departmentId) {
      return this.db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.organizationId, organizationId),
            eq(tasks.departmentId, m.departmentId),
            isNull(tasks.deletedAt),
          ),
        );
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

    return this.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.organizationId, organizationId), inArray(tasks.id, ids)));
  }
}
