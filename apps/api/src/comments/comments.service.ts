import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq, isNull } from "drizzle-orm";
import { activityLedger, commentMentions, comments, taskAssignees, user } from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { DRIZZLE } from "../db/drizzle.constants";
import { AuthorizationService } from "../authorization/authorization.service";
import { PushNotificationsService } from "../push/push-notifications.service";
import { CollaborationService } from "../realtime/collaboration.service";

const MENTION_REGEX = /@\[([^\]]+)\]\(([^)]+)\)/g;

function extractMentions(body: string): { name: string; userId: string }[] {
  const mentions: { name: string; userId: string }[] = [];
  let m: RegExpExecArray | null;
  MENTION_REGEX.lastIndex = 0;
  while ((m = MENTION_REGEX.exec(body)) !== null) {
    mentions.push({ name: m[1]!, userId: m[2]! });
  }
  return mentions;
}

@Injectable()
export class CommentsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: AppDatabase,
    private readonly authz: AuthorizationService,
    private readonly pushNotifications: PushNotificationsService,
    private readonly collaboration: CollaborationService,
  ) {}

  private async notifyLedger(
    access: { task: { organizationId: string; title: string; assignerId: string } },
    userId: string,
    taskId: string,
    entry: typeof activityLedger.$inferSelect,
  ) {
    const assignees = await this.db
      .select({ userId: taskAssignees.userId })
      .from(taskAssignees)
      .where(eq(taskAssignees.taskId, taskId));

    void this.pushNotifications
      .notifyLedgerActivity({
        organizationId: access.task.organizationId,
        actorUserId: userId,
        taskId,
        taskTitle: access.task.title,
        assignerUserId: access.task.assignerId,
        assigneeUserIds: assignees.map((a) => a.userId),
        ledgerDelta: [entry],
      })
      .catch(() => {});
  }

  async listForTask(userId: string, taskId: string) {
    const access = await this.authz.getTaskAccess(userId, taskId);
    const rows = await this.db
      .select({
        id: comments.id,
        taskId: comments.taskId,
        parentCommentId: comments.parentCommentId,
        authorId: comments.authorId,
        body: comments.body,
        editedAt: comments.editedAt,
        deletedAt: comments.deletedAt,
        createdAt: comments.createdAt,
        authorName: user.name,
        authorEmail: user.email,
        authorImage: user.image,
      })
      .from(comments)
      .innerJoin(user, eq(comments.authorId, user.id))
      .where(eq(comments.taskId, taskId))
      .orderBy(asc(comments.createdAt));

    return rows.map((r) => ({
      ...r,
      body: r.deletedAt ? null : r.body,
    }));
  }

  async create(userId: string, taskId: string, body: { body: string; parentCommentId?: string }) {
    const access = await this.authz.getTaskAccess(userId, taskId);
    const caps = this.authz.taskCapabilities(access, userId);
    if (!caps.canParticipate) throw new ForbiddenException("Cannot comment on this task");

    const [comment] = await this.db
      .insert(comments)
      .values({
        taskId,
        parentCommentId: body.parentCommentId ?? null,
        authorId: userId,
        body: body.body,
      })
      .returning();

    const mentions = extractMentions(body.body);
    for (const mention of mentions) {
      if (mention.userId === userId) continue;
      await this.db
        .insert(commentMentions)
        .values({ commentId: comment.id, mentionedUserId: mention.userId })
        .onConflictDoNothing();
    }

    const [entry] = await this.db
      .insert(activityLedger)
      .values({
        taskId,
        actorId: userId,
        type: "comment_added",
        payload: { commentId: comment!.id, preview: body.body.slice(0, 80) },
      })
      .returning();

    await this.notifyLedger(access, userId, taskId, entry!);
    this.collaboration.notifyOrgChanged(access.task.organizationId, taskId);
    return comment;
  }

  async edit(userId: string, commentId: string, body: string) {
    const [comment] = await this.db.select().from(comments).where(eq(comments.id, commentId)).limit(1);
    if (!comment) throw new NotFoundException("Comment not found");
    if (comment.authorId !== userId) throw new ForbiddenException("Only the author can edit comments");
    if (comment.deletedAt) throw new ForbiddenException("Cannot edit a deleted comment");

    const [updated] = await this.db
      .update(comments)
      .set({ body, editedAt: new Date() })
      .where(eq(comments.id, commentId))
      .returning();

    const access = await this.authz.getTaskAccess(userId, comment.taskId);
    const [entry] = await this.db
      .insert(activityLedger)
      .values({
        taskId: comment.taskId,
        actorId: userId,
        type: "comment_edited",
        payload: { commentId },
      })
      .returning();

    await this.notifyLedger(access, userId, comment.taskId, entry!);
    this.collaboration.notifyOrgChanged(access.task.organizationId, comment.taskId);
    return updated;
  }

  async remove(userId: string, commentId: string) {
    const [comment] = await this.db.select().from(comments).where(eq(comments.id, commentId)).limit(1);
    if (!comment) throw new NotFoundException("Comment not found");

    const access = await this.authz.getTaskAccess(userId, comment.taskId);
    const isAuthor = comment.authorId === userId;
    const isOwner = access.isOwner;
    if (!isAuthor && !isOwner) throw new ForbiddenException("Cannot delete this comment");

    await this.db
      .update(comments)
      .set({ deletedAt: new Date() })
      .where(and(eq(comments.id, commentId), isNull(comments.deletedAt)));

    const [entry] = await this.db
      .insert(activityLedger)
      .values({
        taskId: comment.taskId,
        actorId: userId,
        type: "comment_deleted",
        payload: { commentId },
      })
      .returning();

    await this.notifyLedger(access, userId, comment.taskId, entry!);
    this.collaboration.notifyOrgChanged(access.task.organizationId, comment.taskId);
  }
}
