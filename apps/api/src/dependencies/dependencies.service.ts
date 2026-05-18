import { BadRequestException, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import { activityLedger, taskDependencies, tasks } from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { DRIZZLE } from "../db/drizzle.constants";
import { AuthorizationService } from "../authorization/authorization.service";
import { CollaborationService } from "../realtime/collaboration.service";

@Injectable()
export class DependenciesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: AppDatabase,
    private readonly authz: AuthorizationService,
    private readonly collaboration: CollaborationService,
  ) {}

  private async wouldCreateCycle(taskId: string, dependsOnTaskId: string): Promise<boolean> {
    // Check if dependsOnTaskId is reachable FROM taskId following existing deps
    // If yes, adding taskId → dependsOnTaskId would create a cycle
    const visited = new Set<string>();
    const queue = [taskId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === dependsOnTaskId) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      const blockers = await this.db
        .select({ dependsOnTaskId: taskDependencies.dependsOnTaskId })
        .from(taskDependencies)
        .where(eq(taskDependencies.taskId, current));
      for (const b of blockers) queue.push(b.dependsOnTaskId);
    }
    return false;
  }

  async add(userId: string, taskId: string, dependsOnTaskId: string) {
    if (taskId === dependsOnTaskId) throw new BadRequestException("A task cannot depend on itself");

    const [access, blockerAccess] = await Promise.all([
      this.authz.getTaskAccess(userId, taskId),
      this.authz.getTaskAccess(userId, dependsOnTaskId),
    ]);
    const caps = this.authz.taskCapabilities(access, userId);
    if (!caps.canReschedule) throw new ForbiddenException("Cannot modify dependencies on this task");

    if (await this.wouldCreateCycle(dependsOnTaskId, taskId)) {
      throw new BadRequestException("Adding this dependency would create a circular dependency");
    }

    await this.db
      .insert(taskDependencies)
      .values({ taskId, dependsOnTaskId })
      .onConflictDoNothing();

    await this.db.insert(activityLedger).values({
      taskId,
      actorId: userId,
      type: "dependency_added",
      payload: { dependsOnTaskId, dependsOnTaskTitle: blockerAccess.task.title },
    });

    this.collaboration.notifyOrgChanged(access.task.organizationId, taskId);
  }

  async remove(userId: string, taskId: string, dependsOnTaskId: string) {
    const access = await this.authz.getTaskAccess(userId, taskId);
    const caps = this.authz.taskCapabilities(access, userId);
    if (!caps.canReschedule) throw new ForbiddenException("Cannot modify dependencies on this task");

    const [blockerRow] = await this.db
      .select({ title: tasks.title })
      .from(tasks)
      .where(eq(tasks.id, dependsOnTaskId))
      .limit(1);

    await this.db
      .delete(taskDependencies)
      .where(and(eq(taskDependencies.taskId, taskId), eq(taskDependencies.dependsOnTaskId, dependsOnTaskId)));

    await this.db.insert(activityLedger).values({
      taskId,
      actorId: userId,
      type: "dependency_removed",
      payload: { dependsOnTaskId, dependsOnTaskTitle: blockerRow?.title ?? dependsOnTaskId },
    });

    this.collaboration.notifyOrgChanged(access.task.organizationId, taskId);
  }

  async listBlockers(userId: string, taskId: string) {
    const access = await this.authz.getTaskAccess(userId, taskId);
    const rows = await this.db
      .select({ dependsOnTaskId: taskDependencies.dependsOnTaskId })
      .from(taskDependencies)
      .where(eq(taskDependencies.taskId, taskId));

    if (rows.length === 0) return [];

    const blockerIds = rows.map((r) => r.dependsOnTaskId);
    const blockerTasks = await this.db
      .select({ id: tasks.id, title: tasks.title, status: tasks.status })
      .from(tasks)
      .where(inArray(tasks.id, blockerIds));

    return blockerTasks;
  }

  async listBlocking(userId: string, taskId: string) {
    await this.authz.getTaskAccess(userId, taskId);
    const rows = await this.db
      .select({ taskId: taskDependencies.taskId })
      .from(taskDependencies)
      .where(eq(taskDependencies.dependsOnTaskId, taskId));

    if (rows.length === 0) return [];

    const blockingIds = rows.map((r) => r.taskId);
    return this.db
      .select({ id: tasks.id, title: tasks.title, status: tasks.status })
      .from(tasks)
      .where(inArray(tasks.id, blockingIds));
  }
}
