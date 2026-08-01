import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, isNull, sql, sum } from "drizzle-orm";
import { timeEntries, user } from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { DRIZZLE } from "../db/drizzle.constants";
import { AuthorizationService } from "../authorization/authorization.service";

@Injectable()
export class TimeService {
  constructor(
    @Inject(DRIZZLE) private readonly db: AppDatabase,
    private readonly authz: AuthorizationService,
  ) {}

  async start(userId: string, taskId: string) {
    const access = await this.authz.getTaskAccess(userId, taskId);
    const caps = this.authz.taskCapabilities(access, userId);
    if (!caps.canParticipate) throw new ForbiddenException("Cannot log time on this task");

    // Only one running timer per user at a time
    const running = await this.db
      .select({ id: timeEntries.id })
      .from(timeEntries)
      .where(and(eq(timeEntries.userId, userId), isNull(timeEntries.stoppedAt)))
      .limit(1);

    if (running.length > 0) {
      throw new BadRequestException("You already have a running timer. Stop it before starting a new one.");
    }

    const [entry] = await this.db
      .insert(timeEntries)
      .values({ taskId, userId, startedAt: new Date() })
      .returning();

    return entry;
  }

  async stop(userId: string, taskId: string) {
    const running = await this.db
      .select()
      .from(timeEntries)
      .where(and(eq(timeEntries.taskId, taskId), eq(timeEntries.userId, userId), isNull(timeEntries.stoppedAt)))
      .limit(1);

    if (running.length === 0) throw new NotFoundException("No running timer for this task");

    const entry = running[0]!;
    const stoppedAt = new Date();
    const durationSeconds = Math.floor((stoppedAt.getTime() - entry.startedAt.getTime()) / 1000);

    const [updated] = await this.db
      .update(timeEntries)
      .set({ stoppedAt, duration: String(durationSeconds) })
      .where(eq(timeEntries.id, entry.id))
      .returning();

    return updated;
  }

  async logManual(userId: string, taskId: string, body: { startedAt: Date; stoppedAt: Date; note?: string }) {
    const access = await this.authz.getTaskAccess(userId, taskId);
    const caps = this.authz.taskCapabilities(access, userId);
    if (!caps.canParticipate) throw new ForbiddenException("Cannot log time on this task");

    if (body.stoppedAt <= body.startedAt) throw new BadRequestException("Stopped time must be after started time");

    const durationSeconds = Math.floor((body.stoppedAt.getTime() - body.startedAt.getTime()) / 1000);

    const [entry] = await this.db
      .insert(timeEntries)
      .values({
        taskId,
        userId,
        startedAt: body.startedAt,
        stoppedAt: body.stoppedAt,
        duration: String(durationSeconds),
        note: body.note ?? null,
      })
      .returning();

    return entry;
  }

  async listForTask(userId: string, taskId: string) {
    await this.authz.getTaskAccess(userId, taskId);
    return this.db
      .select({
        id: timeEntries.id,
        taskId: timeEntries.taskId,
        userId: timeEntries.userId,
        userName: user.name,
        startedAt: timeEntries.startedAt,
        stoppedAt: timeEntries.stoppedAt,
        duration: timeEntries.duration,
        note: timeEntries.note,
        createdAt: timeEntries.createdAt,
      })
      .from(timeEntries)
      .innerJoin(user, eq(timeEntries.userId, user.id))
      .where(eq(timeEntries.taskId, taskId))
      .orderBy(sql`${timeEntries.createdAt} DESC`);
  }

  async totalForTask(taskId: string): Promise<number> {
    const [row] = await this.db
      .select({ total: sql<string>`coalesce(sum(${timeEntries.duration}::bigint), 0)` })
      .from(timeEntries)
      .where(and(eq(timeEntries.taskId, taskId)));
    return row ? parseInt(row.total, 10) : 0;
  }

  async deleteEntry(userId: string, entryId: string) {
    const [entry] = await this.db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.id, entryId))
      .limit(1);

    if (!entry) throw new NotFoundException("Time entry not found");
    if (entry.userId !== userId) {
      const access = await this.authz.getTaskAccess(userId, entry.taskId);
      if (!access.isOwner) throw new ForbiddenException("Cannot delete another user's time entry");
    }

    await this.db.delete(timeEntries).where(eq(timeEntries.id, entryId));
  }
}
