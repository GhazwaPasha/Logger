import { randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import {
  account,
  activityLedger,
  apiKeys,
  comments,
  goals,
  milestones,
  oauthAccessToken,
  oauthApplication,
  oauthConsent,
  organizationMemberManagedDepartments,
  organizationMembers,
  organizations,
  pushSubscriptions,
  session,
  taskAssignees,
  timeEntries,
  user,
  verification,
} from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { DRIZZLE } from "../db/drizzle.constants";
import { CollaborationService } from "../realtime/collaboration.service";

/** Shown wherever the anonymised user still appears (task history, comments, time entries, ...). */
export const DELETED_USER_NAME = "Deleted user";
/** Reserved TLD (RFC 2606): a placeholder address that can never receive mail or collide with a real one. */
const DELETED_EMAIL_DOMAIN = "deleted.invalid";
const SAFE_USER_ID = /^[A-Za-z0-9_-]+$/;

@Injectable()
export class AccountService {
  constructor(
    @Inject(DRIZZLE) private readonly db: AppDatabase,
    private readonly collaboration: CollaborationService,
  ) {}

  /**
   * Deletes the caller's account by *anonymising* it rather than removing the row.
   *
   * Tasks, ledger entries, comments, attachments and time entries reference the user with
   * `ON DELETE RESTRICT`: LogBase's activity trail is meant to outlive any one person. So the
   * `user` row (and its opaque id) stays, but everything that identifies a person goes:
   *
   *  - name and email are replaced with a placeholder ("Deleted user" / `deleted-<uuid>@deleted.invalid`),
   *    avatar URLs cleared
   *  - sign-in methods (password hash, Discord/Google links), sessions, API keys, OAuth grants and
   *    push subscriptions are deleted, so the account can no longer be signed into
   *  - workspace memberships and task assignments are removed (tasks fall back to unassigned)
   *  - `@[Name](userId)` mentions in comment text are rewritten to the placeholder name
   *
   * Blocked while the user is the *only* owner of a workspace: that workspace would be left with
   * no one able to manage it.
   */
  async deleteAccount(userId: string, body: unknown): Promise<{ ok: true }> {
    const confirm = (body as { confirm?: unknown } | null | undefined)?.confirm;
    if (confirm !== "DELETE") {
      throw new BadRequestException('Type "DELETE" to confirm deleting your account');
    }

    const [existing] = await this.db.select({ id: user.id, email: user.email }).from(user).where(eq(user.id, userId)).limit(1);
    if (!existing) throw new NotFoundException("Account not found");
    if (existing.email.endsWith(`@${DELETED_EMAIL_DOMAIN}`)) return { ok: true };

    const memberships = await this.db
      .select({
        memberId: organizationMembers.id,
        organizationId: organizationMembers.organizationId,
        role: organizationMembers.role,
        organizationName: organizations.name,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
      .where(eq(organizationMembers.userId, userId));

    const soleOwnerOf: string[] = [];
    for (const m of memberships) {
      if (m.role !== "owner") continue;
      const otherOwners = await this.db
        .select({ id: organizationMembers.id })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, m.organizationId),
            eq(organizationMembers.role, "owner"),
            ne(organizationMembers.userId, userId),
          ),
        )
        .limit(1);
      if (otherOwners.length === 0) soleOwnerOf.push(m.organizationName);
    }
    if (soleOwnerOf.length > 0) {
      const names = soleOwnerOf.map((n) => `"${n}"`).join(", ");
      throw new ConflictException(
        `You're the only owner of ${names}. Make another member an owner, or delete the workspace, before deleting your account.`,
      );
    }

    const placeholderEmail = `deleted-${randomUUID()}@${DELETED_EMAIL_DOMAIN}`;
    const memberIds = memberships.map((m) => m.memberId);
    const organizationIds = [...new Set(memberships.map((m) => m.organizationId))];

    await this.db.transaction(async (tx) => {
      // Anything that lets someone sign in as, or act for, this user.
      await tx.delete(session).where(eq(session.userId, userId));
      await tx.delete(account).where(eq(account.userId, userId));
      await tx.delete(apiKeys).where(eq(apiKeys.userId, userId));
      await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
      await tx.delete(oauthAccessToken).where(eq(oauthAccessToken.userId, userId));
      await tx.delete(oauthConsent).where(eq(oauthConsent.userId, userId));
      // Deleting a registered OAuth client would cascade away *other* users' grants for it; just unlink it.
      await tx.update(oauthApplication).set({ userId: null }).where(eq(oauthApplication.userId, userId));
      // Pending email-verification / password-reset tokens are keyed by the email address.
      await tx.delete(verification).where(sql`lower(${verification.identifier}) like ${`%${existing.email.toLowerCase()}%`}`);

      // Leave every workspace.
      if (memberIds.length > 0) {
        await tx
          .delete(organizationMemberManagedDepartments)
          .where(inArray(organizationMemberManagedDepartments.organizationMemberId, memberIds));
        await tx.delete(organizationMembers).where(inArray(organizationMembers.id, memberIds));
      }

      // Their tasks go back to unassigned; record it in each task's ledger like a manual reassignment would.
      const assigned = await tx
        .select({ taskId: taskAssignees.taskId })
        .from(taskAssignees)
        .where(eq(taskAssignees.userId, userId));
      if (assigned.length > 0) {
        const taskIds = [...new Set(assigned.map((r) => r.taskId))];
        const allRows = await tx
          .select({ taskId: taskAssignees.taskId, userId: taskAssignees.userId })
          .from(taskAssignees)
          .where(inArray(taskAssignees.taskId, taskIds));
        const byTask = new Map<string, string[]>();
        for (const r of allRows) byTask.set(r.taskId, [...(byTask.get(r.taskId) ?? []), r.userId]);

        await tx.delete(taskAssignees).where(and(inArray(taskAssignees.taskId, taskIds), eq(taskAssignees.userId, userId)));
        for (const taskId of taskIds) {
          const previousAssigneeUserIds = [...(byTask.get(taskId) ?? [])].sort();
          const assigneeUserIds = previousAssigneeUserIds.filter((id) => id !== userId);
          await tx.insert(activityLedger).values({
            taskId,
            actorId: userId,
            type: "assignee_change",
            payload: { previousAssigneeUserIds, assigneeUserIds },
          });
        }
      }

      await tx.update(goals).set({ ownerId: null }).where(eq(goals.ownerId, userId));
      await tx.update(milestones).set({ ownerId: null }).where(eq(milestones.ownerId, userId));

      // A timer left running would keep accruing time to an account that no longer exists.
      const now = new Date();
      const running = await tx
        .select({ id: timeEntries.id, startedAt: timeEntries.startedAt })
        .from(timeEntries)
        .where(and(eq(timeEntries.userId, userId), isNull(timeEntries.stoppedAt)));
      for (const t of running) {
        await tx
          .update(timeEntries)
          .set({ stoppedAt: now, duration: String(Math.max(0, Math.floor((now.getTime() - t.startedAt.getTime()) / 1000))) })
          .where(eq(timeEntries.id, t.id));
      }

      // The display name is copied into other people's comment text as `@[Name](userId)`.
      if (SAFE_USER_ID.test(userId)) {
        await tx
          .update(comments)
          .set({
            body: sql`regexp_replace(${comments.body}, ${`@\\[[^\\]]*\\]\\(${userId}\\)`}, ${`@[${DELETED_USER_NAME}](${userId})`}, 'g')`,
          })
          .where(sql`${comments.body} like ${`%](${userId})%`}`);
      }

      // Finally scrub the identity itself. The id is kept so history stays attributable to "a deleted user".
      await tx
        .update(user)
        .set({
          name: DELETED_USER_NAME,
          email: placeholderEmail,
          emailVerified: false,
          image: null,
          discordImage: null,
          googleImage: null,
          avatarSource: null,
        })
        .where(eq(user.id, userId));
    });

    for (const organizationId of organizationIds) this.collaboration.notifyOrgChanged(organizationId, null);
    return { ok: true };
  }
}
