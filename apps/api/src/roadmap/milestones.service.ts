import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import { createMilestoneSchema, linkMilestoneTasksSchema, updateMilestoneSchema } from "@work-ledger/contracts";
import { milestones, milestoneTasks, tasks } from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { DRIZZLE } from "../db/drizzle.constants";
import { AuthorizationService } from "../authorization/authorization.service";
import { DepartmentsService } from "../departments/departments.service";
import { CollaborationService } from "../realtime/collaboration.service";
import { GoalsService } from "./goals.service";

type MilestoneRow = typeof milestones.$inferSelect;

@Injectable()
export class MilestonesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: AppDatabase,
    private readonly authz: AuthorizationService,
    private readonly departments: DepartmentsService,
    private readonly collaboration: CollaborationService,
    private readonly goals: GoalsService,
  ) {}

  /** Owner: full write. Manager: write only within their managed level(s). Member: read-only. Accepts an already-fetched member to skip a redundant lookup when the caller fetched it in a parallel batch. */
  private async assertCanWrite(
    userId: string,
    organizationId: string,
    departmentId: string | null,
    prefetchedMember?: Awaited<ReturnType<AuthorizationService["assertOrgMember"]>>,
  ) {
    const member = prefetchedMember ?? (await this.authz.assertOrgMember(userId, organizationId));
    if (member.role === "owner") return;
    if (member.role === "manager" && departmentId) {
      const managed = await this.authz.managedDepartmentIdsForUser(userId, organizationId);
      if (managed.includes(departmentId)) return;
    }
    throw new ForbiddenException("No write access to this milestone");
  }

  async getMilestoneOrThrow(organizationId: string, milestoneId: string): Promise<MilestoneRow> {
    const rows = await this.db
      .select()
      .from(milestones)
      .where(and(eq(milestones.id, milestoneId), eq(milestones.organizationId, organizationId)))
      .limit(1);
    if (rows.length === 0) throw new NotFoundException("Milestone not found");
    return rows[0]!;
  }

  async create(userId: string, organizationId: string, body: unknown) {
    const parsed = createMilestoneSchema.parse(body);

    // Independent reads — run concurrently instead of round-tripping to the DB one at a time.
    const [goal, parent, , member] = await Promise.all([
      this.goals.getGoalOrThrow(organizationId, parsed.goalId),
      parsed.parentId ? this.getMilestoneOrThrow(organizationId, parsed.parentId) : Promise.resolve(null),
      parsed.departmentId ? this.departments.assertDeptInOrg(organizationId, parsed.departmentId) : Promise.resolve(),
      this.authz.assertOrgMember(userId, organizationId),
    ]);
    if (parent && parent.goalId !== parsed.goalId) {
      throw new BadRequestException("A sub-milestone must belong to the same goal as its parent");
    }
    const departmentId = parsed.departmentId ?? parent?.departmentId ?? goal.departmentId ?? null;
    await this.assertCanWrite(userId, organizationId, departmentId, member);

    const [row] = await this.db
      .insert(milestones)
      .values({
        organizationId,
        departmentId,
        goalId: parsed.goalId,
        parentId: parsed.parentId ?? null,
        title: parsed.title,
        description: parsed.description ?? null,
        periodStart: new Date(parsed.periodStart),
        periodEnd: new Date(parsed.periodEnd),
        ownerId: parsed.ownerId ?? null,
      })
      .returning();
    this.collaboration.notifyOrgChanged(organizationId, null);
    return row!;
  }

  async update(userId: string, organizationId: string, milestoneId: string, body: unknown) {
    const existing = await this.getMilestoneOrThrow(organizationId, milestoneId);
    await this.assertCanWrite(userId, organizationId, existing.departmentId);
    const parsed = updateMilestoneSchema.parse(body);

    if (parsed.departmentId !== undefined && parsed.departmentId) {
      await this.departments.assertDeptInOrg(organizationId, parsed.departmentId);
    }
    if (parsed.parentId !== undefined && parsed.parentId === milestoneId) {
      throw new BadRequestException("A milestone cannot be its own parent");
    }
    if (parsed.parentId) {
      const parent = await this.getMilestoneOrThrow(organizationId, parsed.parentId);
      if (parent.goalId !== existing.goalId) {
        throw new BadRequestException("A sub-milestone must belong to the same goal as its parent");
      }
    }

    const [row] = await this.db
      .update(milestones)
      .set({
        ...(parsed.title !== undefined ? { title: parsed.title } : {}),
        ...(parsed.description !== undefined ? { description: parsed.description } : {}),
        ...(parsed.parentId !== undefined ? { parentId: parsed.parentId } : {}),
        ...(parsed.departmentId !== undefined ? { departmentId: parsed.departmentId } : {}),
        ...(parsed.periodStart !== undefined ? { periodStart: new Date(parsed.periodStart) } : {}),
        ...(parsed.periodEnd !== undefined ? { periodEnd: new Date(parsed.periodEnd) } : {}),
        ...(parsed.ownerId !== undefined ? { ownerId: parsed.ownerId } : {}),
        ...(parsed.status !== undefined ? { status: parsed.status } : {}),
        ...(parsed.orderIndex !== undefined ? { orderIndex: parsed.orderIndex } : {}),
      })
      .where(and(eq(milestones.id, milestoneId), eq(milestones.organizationId, organizationId)))
      .returning();
    this.collaboration.notifyOrgChanged(organizationId, null);
    return row!;
  }

  /** Cascades sub-milestones + task links (FK). */
  async remove(userId: string, organizationId: string, milestoneId: string) {
    const existing = await this.getMilestoneOrThrow(organizationId, milestoneId);
    await this.assertCanWrite(userId, organizationId, existing.departmentId);
    await this.db
      .delete(milestones)
      .where(and(eq(milestones.id, milestoneId), eq(milestones.organizationId, organizationId)));
    this.collaboration.notifyOrgChanged(organizationId, null);
  }

  async linkTasks(userId: string, organizationId: string, milestoneId: string, body: unknown) {
    const parsed = linkMilestoneTasksSchema.parse(body);

    // Independent reads — run concurrently instead of round-tripping to the DB one at a time.
    const [existing, taskRows] = await Promise.all([
      this.getMilestoneOrThrow(organizationId, milestoneId),
      this.db
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(inArray(tasks.id, parsed.taskIds), eq(tasks.organizationId, organizationId))),
    ]);
    if (taskRows.length !== parsed.taskIds.length) {
      throw new BadRequestException("One or more tasks do not belong to this organization");
    }
    await this.assertCanWrite(userId, organizationId, existing.departmentId);

    await this.db
      .insert(milestoneTasks)
      .values(parsed.taskIds.map((taskId) => ({ milestoneId, taskId })))
      .onConflictDoNothing();
    this.collaboration.notifyOrgChanged(organizationId, null);
    return { linkedTaskIds: parsed.taskIds };
  }

  async unlinkTask(userId: string, organizationId: string, milestoneId: string, taskId: string) {
    const existing = await this.getMilestoneOrThrow(organizationId, milestoneId);
    await this.assertCanWrite(userId, organizationId, existing.departmentId);
    await this.db
      .delete(milestoneTasks)
      .where(and(eq(milestoneTasks.milestoneId, milestoneId), eq(milestoneTasks.taskId, taskId)));
    this.collaboration.notifyOrgChanged(organizationId, null);
  }
}
