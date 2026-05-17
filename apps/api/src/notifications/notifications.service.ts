import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { notifications } from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { DRIZZLE } from "../db/drizzle.constants";
import { CollaborationService } from "../realtime/collaboration.service";

export type CreateNotificationOpts = {
  userId: string;
  organizationId: string;
  taskId?: string | null;
  type: string;
  title: string;
  body: string;
  href?: string | null;
};

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: AppDatabase,
    private readonly collaboration: CollaborationService,
  ) {}

  async create(opts: CreateNotificationOpts) {
    const [row] = await this.db
      .insert(notifications)
      .values({
        userId: opts.userId,
        organizationId: opts.organizationId,
        taskId: opts.taskId ?? null,
        type: opts.type,
        title: opts.title,
        body: opts.body,
        href: opts.href ?? null,
      })
      .returning();
    this.collaboration.notifyUser(opts.userId, { event: "notification_new", notification: row });
    return row;
  }

  async listForUser(userId: string, orgId: string, opts?: { unreadOnly?: boolean; limit?: number }) {
    const limit = Math.min(opts?.limit ?? 50, 100);
    const conditions = [eq(notifications.userId, userId), eq(notifications.organizationId, orgId)];
    if (opts?.unreadOnly) conditions.push(isNull(notifications.readAt));
    return this.db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async markRead(userId: string, ids: string[]) {
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), inArray(notifications.id, ids), isNull(notifications.readAt)));
  }

  async markAllRead(userId: string, orgId: string) {
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), eq(notifications.organizationId, orgId), isNull(notifications.readAt)));
  }

  async countUnread(userId: string, orgId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.organizationId, orgId), isNull(notifications.readAt)));
    return row?.count ?? 0;
  }
}
