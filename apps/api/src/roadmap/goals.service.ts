import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { createGoalSchema, updateGoalSchema } from "@work-ledger/contracts";
import { deletionLog, goals, milestones } from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { DRIZZLE } from "../db/drizzle.constants";
import { AuthorizationService } from "../authorization/authorization.service";
import { DepartmentsService } from "../departments/departments.service";
import { CollaborationService } from "../realtime/collaboration.service";

type GoalRow = typeof goals.$inferSelect;

@Injectable()
export class GoalsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: AppDatabase,
    private readonly authz: AuthorizationService,
    private readonly departments: DepartmentsService,
    private readonly collaboration: CollaborationService,
  ) {}

  async getGoalOrThrow(organizationId: string, goalId: string): Promise<GoalRow> {
    const rows = await this.db
      .select()
      .from(goals)
      .where(and(eq(goals.id, goalId), eq(goals.organizationId, organizationId)))
      .limit(1);
    if (rows.length === 0) throw new NotFoundException("Goal not found");
    return rows[0]!;
  }

  /** Owner: full write. Manager: write within their managed level(s). A goal's own owner: write to that specific goal. */
  private async assertCanWrite(
    userId: string,
    organizationId: string,
    goal: GoalRow | null,
    departmentId: string | null,
  ) {
    const member = await this.authz.assertOrgMember(userId, organizationId);
    if (member.role === "owner") return;
    if (goal && goal.ownerId === userId) return;
    if (member.role === "manager" && departmentId) {
      const managed = await this.authz.managedDepartmentIdsForUser(userId, organizationId);
      if (managed.includes(departmentId)) return;
    }
    throw new ForbiddenException("No write access to this goal");
  }

  async create(userId: string, organizationId: string, body: unknown) {
    const parsed = createGoalSchema.parse(body);
    await this.assertCanWrite(userId, organizationId, null, parsed.departmentId ?? null);

    if (parsed.departmentId) {
      await this.departments.assertDeptInOrg(organizationId, parsed.departmentId);
    }

    const [row] = await this.db
      .insert(goals)
      .values({
        organizationId,
        departmentId: parsed.departmentId ?? null,
        title: parsed.title,
        description: parsed.description ?? null,
        ownerId: parsed.ownerId ?? null,
        status: parsed.status ?? "on_track",
        targetDate: parsed.targetDate ? new Date(parsed.targetDate) : null,
      })
      .returning();
    this.collaboration.notifyOrgChanged(organizationId, row!.id);
    return row!;
  }

  async update(userId: string, organizationId: string, goalId: string, body: unknown) {
    const existing = await this.getGoalOrThrow(organizationId, goalId);
    await this.assertCanWrite(userId, organizationId, existing, existing.departmentId);
    const parsed = updateGoalSchema.parse(body);

    if (parsed.departmentId !== undefined && parsed.departmentId) {
      await this.departments.assertDeptInOrg(organizationId, parsed.departmentId);
    }

    const [row] = await this.db
      .update(goals)
      .set({
        ...(parsed.title !== undefined ? { title: parsed.title } : {}),
        ...(parsed.description !== undefined ? { description: parsed.description } : {}),
        ...(parsed.departmentId !== undefined ? { departmentId: parsed.departmentId } : {}),
        ...(parsed.ownerId !== undefined ? { ownerId: parsed.ownerId } : {}),
        ...(parsed.status !== undefined ? { status: parsed.status } : {}),
        ...(parsed.targetDate !== undefined
          ? { targetDate: parsed.targetDate ? new Date(parsed.targetDate) : null }
          : {}),
      })
      .where(and(eq(goals.id, goalId), eq(goals.organizationId, organizationId)))
      .returning();
    this.collaboration.notifyOrgChanged(organizationId, goalId);
    return row!;
  }

  /** Cascades every milestone under this goal (and their task links) via FK. */
  async remove(userId: string, organizationId: string, goalId: string) {
    const existing = await this.getGoalOrThrow(organizationId, goalId);
    await this.assertCanWrite(userId, organizationId, existing, existing.departmentId);

    const cascadedMilestones = await this.db
      .select({ id: milestones.id, title: milestones.title })
      .from(milestones)
      .where(eq(milestones.goalId, goalId));

    await this.db.insert(deletionLog).values({
      entityType: "goal",
      entityId: goalId,
      organizationId,
      actorId: userId,
      snapshot: {
        title: existing.title,
        description: existing.description,
        cascadedMilestoneIds: cascadedMilestones.map((m) => m.id),
      },
    });

    await this.db.delete(goals).where(and(eq(goals.id, goalId), eq(goals.organizationId, organizationId)));
    this.collaboration.notifyOrgChanged(organizationId, goalId);
  }
}
