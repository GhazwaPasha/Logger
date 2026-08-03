import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, inArray, isNull, lte, notInArray, or, sql } from "drizzle-orm";
import {
  organizationMembers,
  taskAssignees,
  taskAttachments,
  tasks,
  timeEntries,
  user,
} from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { DRIZZLE } from "../db/drizzle.constants";
import { AuthorizationService } from "../authorization/authorization.service";

export type PerformanceScorecardRow = {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  completed: number;
  onTime: number;
  /** Completed after their due date. */
  late: number;
  onTimeRate: number;
  pending: number;
  inProgress: number;
  /** Still open (pending/in-progress) and past their due date. */
  latePending: number;
  lateInProgress: number;
  openAssigned: number;
  timeLoggedSeconds: number;
  /** Discord submission required *and* a channel was actually configured — the only tasks compliance can fairly judge. */
  submissionsRequired: number;
  submissionsFulfilled: number;
  submissionRate: number;
  /** Discord channel configured but submission not mandatory — tracked separately, never counted against compliance. */
  submissionsOptional: number;
  submissionsOptionalFulfilled: number;
  attachmentsRequired: number;
  attachmentsFulfilled: number;
  attachmentRate: number;
};

export type PerformanceScorecardsResponse = {
  members: PerformanceScorecardRow[];
  totals: Omit<PerformanceScorecardRow, "userId" | "name" | "email" | "image" | "role">;
  dateFrom: string;
  dateTo: string;
};

/**
 * One row of a member's task drill-down table — done tasks in range, plus all currently-open tasks
 * regardless of range. A completed recurring task with 2+ occurrences in range collapses into a
 * single "collection" row (`occurrenceCount` set) instead of listing each cycle separately; the
 * currently-open occurrence of a series (if any) is never part of a collection, only past completions.
 */
export type MemberTaskRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  listId: string;
  dueAt: string | null;
  completedAt: string | null;
  late: boolean;
  discordChannelId: string | null;
  discordSubmissionRequired: boolean;
  lastSubmittedAt: string | null;
  attachmentRequired: boolean;
  hasAttachment: boolean;
  timeLoggedSeconds: number;
  /** Set only for a collapsed recurring collection — number of completed occurrences merged into this row. */
  occurrenceCount?: number;
  /** Of those occurrences, how many were completed after their due date. */
  lateCount?: number;
  submissionsRequiredCount?: number;
  submissionsFulfilledCount?: number;
  attachmentsRequiredCount?: number;
  attachmentsFulfilledCount?: number;
};

type EnrichedMemberTaskRow = MemberTaskRow & { recurringSeriesId: string | null };

function rate(num: number, den: number): number {
  return den > 0 ? num / den : 0;
}

function emptyCounters() {
  return {
    completed: 0,
    onTime: 0,
    late: 0,
    pending: 0,
    inProgress: 0,
    latePending: 0,
    lateInProgress: 0,
    openAssigned: 0,
    timeLoggedSeconds: 0,
    submissionsRequired: 0,
    submissionsFulfilled: 0,
    submissionsOptional: 0,
    submissionsOptionalFulfilled: 0,
    attachmentsRequired: 0,
    attachmentsFulfilled: 0,
  };
}

@Injectable()
export class PerformanceService {
  constructor(
    @Inject(DRIZZLE) private readonly db: AppDatabase,
    private readonly authz: AuthorizationService,
  ) {}

  async scorecards(
    requesterId: string,
    organizationId: string,
    opts?: { dateFrom?: string; dateTo?: string },
  ): Promise<PerformanceScorecardsResponse> {
    const membership = await this.authz.assertOrgMember(requesterId, organizationId);
    if (membership.role !== "owner" && membership.role !== "manager") {
      throw new ForbiddenException("Only owners and managers can view performance data");
    }

    const dateTo = opts?.dateTo ? new Date(opts.dateTo) : new Date();
    const dateFrom = opts?.dateFrom
      ? new Date(opts.dateFrom)
      : new Date(dateTo.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Already role-scoped: full org for owners, tasks under managed departments' lists for managers.
    const taskIds = await this.authz.listTaskIdsForUser(requesterId, organizationId);

    const allMembers = await this.db
      .select({
        userId: organizationMembers.userId,
        role: organizationMembers.role,
        email: user.email,
        name: user.name,
        image: user.image,
      })
      .from(organizationMembers)
      .innerJoin(user, eq(organizationMembers.userId, user.id))
      .where(eq(organizationMembers.organizationId, organizationId));

    let roster = allMembers;
    if (membership.role === "manager") {
      // Members have no "home department" field in this schema — department scope only exists
      // at the list/task level — so a manager's roster is derived from who is actually assigned
      // work inside their managed departments' task universe, not a member->department lookup.
      const scopedIds = new Set<string>([requesterId]);
      if (taskIds.length > 0) {
        const assigneeRows = await this.db
          .selectDistinct({ userId: taskAssignees.userId })
          .from(taskAssignees)
          .where(inArray(taskAssignees.taskId, taskIds));
        for (const r of assigneeRows) scopedIds.add(r.userId);
      }
      roster = allMembers.filter((m) => scopedIds.has(m.userId));
    }

    const perUser = new Map<string, ReturnType<typeof emptyCounters>>();
    const get = (userId: string) => {
      let row = perUser.get(userId);
      if (!row) {
        row = emptyCounters();
        perUser.set(userId, row);
      }
      return row;
    };

    if (taskIds.length > 0) {
      const [completionRows, workloadRows, complianceRows, attachmentFulfilledRows, timeRows] =
        await Promise.all([
          this.db
            .select({
              userId: taskAssignees.userId,
              completed: sql<number>`count(*)::int`,
              onTime: sql<number>`count(*) filter (where ${tasks.completedAt} <= ${tasks.dueAt} or ${tasks.dueAt} is null)::int`,
              late: sql<number>`count(*) filter (where ${tasks.completedAt} > ${tasks.dueAt})::int`,
            })
            .from(taskAssignees)
            .innerJoin(tasks, eq(taskAssignees.taskId, tasks.id))
            .where(
              and(
                inArray(tasks.id, taskIds),
                isNull(tasks.deletedAt),
                eq(tasks.status, "done"),
                gte(tasks.completedAt, dateFrom),
                lte(tasks.completedAt, dateTo),
              ),
            )
            .groupBy(taskAssignees.userId),

          // Current workload snapshot — deliberately not date-ranged (it's "what's on their plate right now").
          this.db
            .select({
              userId: taskAssignees.userId,
              openAssigned: sql<number>`count(*)::int`,
              pending: sql<number>`count(*) filter (where ${tasks.status} in ('pending','open','assigned'))::int`,
              inProgress: sql<number>`count(*) filter (where ${tasks.status} in ('in_progress','late'))::int`,
              latePending: sql<number>`count(*) filter (where ${tasks.status} in ('pending','open','assigned') and ${tasks.dueAt} < now())::int`,
              lateInProgress: sql<number>`count(*) filter (where ${tasks.status} in ('in_progress','late') and ${tasks.dueAt} < now())::int`,
            })
            .from(taskAssignees)
            .innerJoin(tasks, eq(taskAssignees.taskId, tasks.id))
            .where(
              and(
                inArray(tasks.id, taskIds),
                isNull(tasks.deletedAt),
                notInArray(tasks.status, ["done", "cancelled"]),
              ),
            )
            .groupBy(taskAssignees.userId),

          // Discord submission is only a real requirement when a channel is actually configured —
          // `discordSubmissionRequired` defaults to true on every task regardless, so without the
          // `discordChannelId is not null` gate this counted tasks that never had Discord submission
          // enabled at all as "required", which is why compliance looked artificially bad.
          this.db
            .select({
              userId: taskAssignees.userId,
              submissionsRequired: sql<number>`count(*) filter (where ${tasks.discordChannelId} is not null and ${tasks.discordSubmissionRequired})::int`,
              submissionsFulfilled: sql<number>`count(*) filter (where ${tasks.discordChannelId} is not null and ${tasks.discordSubmissionRequired} and ${tasks.lastSubmittedAt} is not null)::int`,
              submissionsOptional: sql<number>`count(*) filter (where ${tasks.discordChannelId} is not null and not ${tasks.discordSubmissionRequired})::int`,
              submissionsOptionalFulfilled: sql<number>`count(*) filter (where ${tasks.discordChannelId} is not null and not ${tasks.discordSubmissionRequired} and ${tasks.lastSubmittedAt} is not null)::int`,
              attachmentsRequired: sql<number>`count(*) filter (where ${tasks.attachmentRequired})::int`,
            })
            .from(taskAssignees)
            .innerJoin(tasks, eq(taskAssignees.taskId, tasks.id))
            .where(
              and(
                inArray(tasks.id, taskIds),
                isNull(tasks.deletedAt),
                gte(tasks.createdAt, dateFrom),
                lte(tasks.createdAt, dateTo),
              ),
            )
            .groupBy(taskAssignees.userId),

          this.db
            .select({
              userId: taskAssignees.userId,
              attachmentsFulfilled: sql<number>`count(distinct ${tasks.id})::int`,
            })
            .from(taskAssignees)
            .innerJoin(tasks, eq(taskAssignees.taskId, tasks.id))
            .innerJoin(taskAttachments, eq(taskAttachments.taskId, tasks.id))
            .where(
              and(
                inArray(tasks.id, taskIds),
                isNull(tasks.deletedAt),
                eq(tasks.attachmentRequired, true),
                gte(tasks.createdAt, dateFrom),
                lte(tasks.createdAt, dateTo),
              ),
            )
            .groupBy(taskAssignees.userId),

          this.db
            .select({
              userId: timeEntries.userId,
              seconds: sql<string>`coalesce(sum(${timeEntries.duration}::bigint), 0)`,
            })
            .from(timeEntries)
            .where(
              and(
                inArray(timeEntries.taskId, taskIds),
                gte(timeEntries.createdAt, dateFrom),
                lte(timeEntries.createdAt, dateTo),
              ),
            )
            .groupBy(timeEntries.userId),
        ]);

      for (const r of completionRows) {
        const row = get(r.userId);
        row.completed = r.completed;
        row.onTime = r.onTime;
        row.late = r.late;
      }
      for (const r of workloadRows) {
        const row = get(r.userId);
        row.openAssigned = r.openAssigned;
        row.pending = r.pending;
        row.inProgress = r.inProgress;
        row.latePending = r.latePending;
        row.lateInProgress = r.lateInProgress;
      }
      for (const r of complianceRows) {
        const row = get(r.userId);
        row.submissionsRequired = r.submissionsRequired;
        row.submissionsFulfilled = r.submissionsFulfilled;
        row.submissionsOptional = r.submissionsOptional;
        row.submissionsOptionalFulfilled = r.submissionsOptionalFulfilled;
        row.attachmentsRequired = r.attachmentsRequired;
      }
      for (const r of attachmentFulfilledRows) {
        get(r.userId).attachmentsFulfilled = r.attachmentsFulfilled;
      }
      for (const r of timeRows) {
        get(r.userId).timeLoggedSeconds = Number(r.seconds);
      }
    }

    const members: PerformanceScorecardRow[] = roster.map((m) => {
      const c = perUser.get(m.userId) ?? emptyCounters();
      return {
        userId: m.userId,
        name: m.name,
        email: m.email,
        image: m.image,
        role: m.role,
        ...c,
        onTimeRate: rate(c.onTime, c.onTime + c.late),
        submissionRate: rate(c.submissionsFulfilled, c.submissionsRequired),
        attachmentRate: rate(c.attachmentsFulfilled, c.attachmentsRequired),
      };
    });

    const totalsBase = members.reduce((acc, m) => {
      acc.completed += m.completed;
      acc.onTime += m.onTime;
      acc.late += m.late;
      acc.pending += m.pending;
      acc.inProgress += m.inProgress;
      acc.latePending += m.latePending;
      acc.lateInProgress += m.lateInProgress;
      acc.openAssigned += m.openAssigned;
      acc.timeLoggedSeconds += m.timeLoggedSeconds;
      acc.submissionsRequired += m.submissionsRequired;
      acc.submissionsFulfilled += m.submissionsFulfilled;
      acc.submissionsOptional += m.submissionsOptional;
      acc.submissionsOptionalFulfilled += m.submissionsOptionalFulfilled;
      acc.attachmentsRequired += m.attachmentsRequired;
      acc.attachmentsFulfilled += m.attachmentsFulfilled;
      return acc;
    }, emptyCounters());

    return {
      members: members.sort((a, b) => b.completed - a.completed),
      totals: {
        ...totalsBase,
        onTimeRate: rate(totalsBase.onTime, totalsBase.onTime + totalsBase.late),
        submissionRate: rate(totalsBase.submissionsFulfilled, totalsBase.submissionsRequired),
        attachmentRate: rate(totalsBase.attachmentsFulfilled, totalsBase.attachmentsRequired),
      },
      dateFrom: dateFrom.toISOString(),
      dateTo: dateTo.toISOString(),
    };
  }

  /**
   * A member's own task drill-down: done tasks completed in range, plus every currently-open task
   * regardless of range (matches the "current workload" semantics of the scorecard). Deliberately
   * a server query rather than filtering the client's workspace task cache, which is paginated
   * (25–50 per status) and would silently under-report for anyone with more history than that.
   */
  async memberTasks(
    requesterId: string,
    organizationId: string,
    targetUserId: string,
    opts?: { dateFrom?: string; dateTo?: string },
  ): Promise<MemberTaskRow[]> {
    const membership = await this.authz.assertOrgMember(requesterId, organizationId);
    if (membership.role !== "owner" && membership.role !== "manager") {
      throw new ForbiddenException("Only owners and managers can view performance data");
    }

    const dateTo = opts?.dateTo ? new Date(opts.dateTo) : new Date();
    const dateFrom = opts?.dateFrom
      ? new Date(opts.dateFrom)
      : new Date(dateTo.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Same scoping as `scorecards()` — a manager querying a userId outside their managed
    // departments simply finds no matching tasks, which is a safe way to fail closed.
    const taskIds = await this.authz.listTaskIdsForUser(requesterId, organizationId);
    if (taskIds.length === 0) return [];

    const rows = await this.db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        listId: tasks.listId,
        dueAt: tasks.dueAt,
        completedAt: tasks.completedAt,
        discordChannelId: tasks.discordChannelId,
        discordSubmissionRequired: tasks.discordSubmissionRequired,
        lastSubmittedAt: tasks.lastSubmittedAt,
        attachmentRequired: tasks.attachmentRequired,
        recurringSeriesId: tasks.recurringSeriesId,
      })
      .from(taskAssignees)
      .innerJoin(tasks, eq(taskAssignees.taskId, tasks.id))
      .where(
        and(
          eq(taskAssignees.userId, targetUserId),
          inArray(tasks.id, taskIds),
          isNull(tasks.deletedAt),
          or(
            and(eq(tasks.status, "done"), gte(tasks.completedAt, dateFrom), lte(tasks.completedAt, dateTo)),
            notInArray(tasks.status, ["done", "cancelled"]),
          ),
        ),
      )
      .orderBy(tasks.dueAt);

    if (rows.length === 0) return [];

    const taskIdList = rows.map((r) => r.id);

    const [attachmentRows, timeRows] = await Promise.all([
      this.db
        .selectDistinct({ taskId: taskAttachments.taskId })
        .from(taskAttachments)
        .where(inArray(taskAttachments.taskId, taskIdList)),
      this.db
        .select({
          taskId: timeEntries.taskId,
          seconds: sql<string>`coalesce(sum(${timeEntries.duration}::bigint), 0)`,
        })
        .from(timeEntries)
        .where(
          and(
            inArray(timeEntries.taskId, taskIdList),
            eq(timeEntries.userId, targetUserId),
            gte(timeEntries.createdAt, dateFrom),
            lte(timeEntries.createdAt, dateTo),
          ),
        )
        .groupBy(timeEntries.taskId),
    ]);

    const attachedTaskIds = new Set(attachmentRows.map((r) => r.taskId));
    const secondsByTask = new Map(timeRows.map((r) => [r.taskId, Number(r.seconds)]));

    const enriched: EnrichedMemberTaskRow[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      priority: r.priority,
      listId: r.listId,
      dueAt: r.dueAt ? r.dueAt.toISOString() : null,
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
      late: r.completedAt != null && r.dueAt != null && r.completedAt.getTime() > r.dueAt.getTime(),
      discordChannelId: r.discordChannelId,
      discordSubmissionRequired: r.discordSubmissionRequired,
      lastSubmittedAt: r.lastSubmittedAt ? r.lastSubmittedAt.toISOString() : null,
      attachmentRequired: r.attachmentRequired,
      hasAttachment: attachedTaskIds.has(r.id),
      timeLoggedSeconds: secondsByTask.get(r.id) ?? 0,
      recurringSeriesId: r.recurringSeriesId,
    }));

    return this.collapseRecurringCompletions(enriched);
  }

  /** Merges completed occurrences of the same recurring series (2+) into one collection row; everything else passes through untouched. */
  private collapseRecurringCompletions(rows: EnrichedMemberTaskRow[]): MemberTaskRow[] {
    const bySeries = new Map<string, EnrichedMemberTaskRow[]>();
    const passthrough: MemberTaskRow[] = [];

    for (const r of rows) {
      if (r.status === "done" && r.recurringSeriesId) {
        const arr = bySeries.get(r.recurringSeriesId) ?? [];
        arr.push(r);
        bySeries.set(r.recurringSeriesId, arr);
      } else {
        const { recurringSeriesId: _drop, ...rest } = r;
        passthrough.push(rest);
      }
    }

    const collections: MemberTaskRow[] = [];
    for (const group of bySeries.values()) {
      if (group.length < 2) {
        const { recurringSeriesId: _drop, ...rest } = group[0]!;
        passthrough.push(rest);
        continue;
      }
      const sorted = [...group].sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
      const latest = sorted[0]!;
      const submissionApplicable = latest.discordChannelId != null && latest.discordSubmissionRequired;
      collections.push({
        id: `series:${latest.recurringSeriesId}`,
        title: latest.title,
        status: "done",
        priority: latest.priority,
        listId: latest.listId,
        dueAt: null,
        completedAt: latest.completedAt,
        late: group.some((g) => g.late),
        discordChannelId: latest.discordChannelId,
        discordSubmissionRequired: latest.discordSubmissionRequired,
        lastSubmittedAt: latest.lastSubmittedAt,
        attachmentRequired: latest.attachmentRequired,
        hasAttachment: latest.hasAttachment,
        timeLoggedSeconds: group.reduce((s, g) => s + g.timeLoggedSeconds, 0),
        occurrenceCount: group.length,
        lateCount: group.filter((g) => g.late).length,
        ...(submissionApplicable
          ? {
              submissionsRequiredCount: group.length,
              submissionsFulfilledCount: group.filter((g) => g.lastSubmittedAt != null).length,
            }
          : {}),
        ...(latest.attachmentRequired
          ? {
              attachmentsRequiredCount: group.length,
              attachmentsFulfilledCount: group.filter((g) => g.hasAttachment).length,
            }
          : {}),
      });
    }

    return [...passthrough, ...collections];
  }
}
