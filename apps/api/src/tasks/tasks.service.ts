import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  appendLedgerSchema,
  createSubtaskSchema,
  createTaskSchema,
  patchTaskSchema,
  rescheduleTaskSchema,
  updateSubtaskSchema,
  updateTaskStatusSchema,
} from "@work-ledger/contracts";
import { activityLedger, organizationMembers, subtasks, taskAssignees, tasks } from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { AuthorizationService, type ListTasksOpts } from "../authorization/authorization.service";
import { DRIZZLE } from "../db/drizzle.constants";
import { ListsService } from "../lists/lists.service";
import { PushNotificationsService } from "../push/push-notifications.service";
import { CollaborationService } from "../realtime/collaboration.service";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { computeNextDue, isDueRepeat } from "./compute-next-due";
import { coerceLegacyTaskStatus } from "./task-status-automation";

@Injectable()
export class TasksService {
  constructor(
    @Inject(DRIZZLE) private readonly db: AppDatabase,
    private readonly authz: AuthorizationService,
    private readonly lists: ListsService,
    private readonly pushNotifications: PushNotificationsService,
    private readonly collaboration: CollaborationService,
  ) {}

  async list(userId: string, organizationId: string, opts?: ListTasksOpts) {
    const result = await this.authz.listTasksForUser(userId, organizationId, opts);
    const synced = await this.syncAutomatedStatuses(result.tasks);
    return { tasks: synced, nextCursor: result.nextCursor, total: result.total };
  }

  async create(userId: string, organizationId: string, body: unknown) {
    await this.authz.assertOrgMember(userId, organizationId);
    const parsed = createTaskSchema.parse(body);
    await this.lists.assertListInOrg(organizationId, parsed.listId);

    const dueAt = parsed.dueAt ? new Date(parsed.dueAt) : null;
    const dueRepeat = dueAt ? (parsed.dueRepeat ?? null) : null;
    const initialSubtasks = parsed.initialSubtasks;

    const ledgerDelta: (typeof activityLedger.$inferSelect)[] = [];
    let createdId!: string;

    await this.db.transaction(async (tx) => {
      const [task] = await tx
        .insert(tasks)
        .values({
          ...(parsed.id !== undefined ? { id: parsed.id } : {}),
          organizationId,
          listId: parsed.listId,
          assignerId: userId,
          title: parsed.title,
          dueAt,
          dueRepeat,
          ...(parsed.status !== undefined ? { status: parsed.status } : {}),
          ...(parsed.priority !== undefined ? { priority: parsed.priority } : {}),
        })
        .returning();

      createdId = task!.id;

      if (dueRepeat && dueAt) {
        await tx
          .update(tasks)
          .set({ recurringSeriesId: createdId })
          .where(eq(tasks.id, createdId));
      }

      if (parsed.assigneeUserIds?.length) {
        const rows = parsed.assigneeUserIds.map((uid) => ({
          taskId: createdId,
          userId: uid,
        }));
        await tx
          .insert(taskAssignees)
          .values(rows)
          .onConflictDoNothing({ target: [taskAssignees.taskId, taskAssignees.userId] });
      }

      if (initialSubtasks.length > 0) {
        await tx.insert(subtasks).values(initialSubtasks.map((s) => ({ taskId: createdId, title: s.title })));
      }

      const [noteRow] = await tx
        .insert(activityLedger)
        .values({
          taskId: createdId,
          actorId: userId,
          type: "note",
          payload: { message: "Task created.", title: parsed.title },
        })
        .returning();
      ledgerDelta.push(noteRow!);

      if (parsed.assigneeUserIds?.length) {
        const [assignRow] = await tx
          .insert(activityLedger)
          .values({
            taskId: createdId,
            actorId: userId,
            type: "assignee_change",
            payload: {
              previousAssigneeUserIds: [] as string[],
              assigneeUserIds: [...new Set(parsed.assigneeUserIds)].sort(),
            },
          })
          .returning();
        ledgerDelta.push(assignRow!);
      }
    });

    const created = await this.taskMutationResult(userId, createdId, ledgerDelta);
    this.collaboration.notifyOrgChanged(organizationId, createdId);
    return created;
  }

  async getDetail(userId: string, taskId: string) {
    await this.applyAutomationForTaskId(taskId);
    const access = await this.authz.getTaskAccess(userId, taskId);
    const caps = this.authz.taskCapabilities(access, userId);

    const [assignees, ledger, taskSubtasks] = await Promise.all([
      this.db
        .select({ userId: taskAssignees.userId })
        .from(taskAssignees)
        .where(eq(taskAssignees.taskId, taskId)),
      this.db
        .select()
        .from(activityLedger)
        .where(eq(activityLedger.taskId, taskId))
        .orderBy(desc(activityLedger.createdAt)),
      this.db.select().from(subtasks).where(eq(subtasks.taskId, taskId)).orderBy(asc(subtasks.createdAt)),
    ]);

    return {
      task: access.task,
      capabilities: caps,
      assigneeUserIds: assignees.map((a) => a.userId),
      subtasks: taskSubtasks,
      ledger,
    };
  }

  async listSubtasks(userId: string, taskId: string) {
    await this.authz.getTaskAccess(userId, taskId);
    return this.db.select().from(subtasks).where(eq(subtasks.taskId, taskId)).orderBy(asc(subtasks.createdAt));
  }

  async createSubtask(userId: string, taskId: string, body: unknown) {
    const access = await this.authz.getTaskAccess(userId, taskId);
    const caps = this.authz.taskCapabilities(access, userId);
    if (!caps.canAppendLedger) throw new ForbiddenException("Cannot create subtask");
    const parsed = createSubtaskSchema.parse(body);
    const [row] = await this.db
      .insert(subtasks)
      .values({
        taskId,
        title: parsed.title,
      })
      .returning();
    await this.recordTaskActivityNote(userId, taskId, "Subtask added.", { subtaskTitle: parsed.title });
    return row!;
  }

  async patchSubtask(userId: string, taskId: string, subtaskId: string, body: unknown) {
    const access = await this.authz.getTaskAccess(userId, taskId);
    const caps = this.authz.taskCapabilities(access, userId);
    if (!caps.canAppendLedger) throw new ForbiddenException("Cannot update subtask");
    const parsed = updateSubtaskSchema.parse(body);
    const [row] = await this.db
      .update(subtasks)
      .set({
        ...(parsed.title !== undefined ? { title: parsed.title } : {}),
        ...(parsed.done !== undefined ? { done: parsed.done } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(subtasks.id, subtaskId), eq(subtasks.taskId, taskId)))
      .returning();
    if (!row) throw new ForbiddenException("Subtask not found");
    const message =
      parsed.done === true ? "Subtask completed." : parsed.done === false ? "Subtask reopened." : "Subtask updated.";
    await this.recordTaskActivityNote(userId, taskId, message, { subtaskTitle: row.title });
    return row;
  }

  async deleteSubtask(userId: string, taskId: string, subtaskId: string) {
    const access = await this.authz.getTaskAccess(userId, taskId);
    const caps = this.authz.taskCapabilities(access, userId);
    if (!caps.canAppendLedger) throw new ForbiddenException("Cannot delete subtask");
    const [row] = await this.db
      .delete(subtasks)
      .where(and(eq(subtasks.id, subtaskId), eq(subtasks.taskId, taskId)))
      .returning();
    if (!row) throw new ForbiddenException("Subtask not found");
    await this.recordTaskActivityNote(userId, taskId, "Subtask removed.", { subtaskTitle: row.title });
    return row;
  }

  async appendLedger(userId: string, taskId: string, body: unknown) {
    const access = await this.authz.getTaskAccess(userId, taskId);
    const caps = this.authz.taskCapabilities(access, userId);
    if (!caps.canAppendLedger) throw new ForbiddenException("Cannot append to ledger");

    const parsed = appendLedgerSchema.parse(body);

    if (parsed.clientMutationId) {
      const existing = await this.db
        .select()
        .from(activityLedger)
        .where(
          and(
            eq(activityLedger.taskId, taskId),
            eq(activityLedger.clientMutationId, parsed.clientMutationId),
          ),
        )
        .limit(1);
      if (existing.length > 0) {
        return { idempotent: true as const, entry: existing[0]! };
      }
    }

    const [entry] = await this.db
      .insert(activityLedger)
      .values({
        taskId,
        actorId: userId,
        type: parsed.type,
        payload: parsed.payload as Record<string, unknown>,
        clientMutationId: parsed.clientMutationId ?? null,
      })
      .returning();

    const assigneesAfter = await this.db
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
        assigneeUserIds: assigneesAfter.map((a) => a.userId),
        ledgerDelta: [entry!],
      })
      .catch(() => {});

    this.collaboration.notifyOrgChanged(access.task.organizationId, taskId);
    return { idempotent: false as const, entry: entry! };
  }

  async reschedule(userId: string, taskId: string, body: unknown) {
    const access = await this.authz.getTaskAccess(userId, taskId);
    const caps = this.authz.taskCapabilities(access, userId);
    if (!caps.canReschedule) throw new ForbiddenException("Cannot reschedule");

    const parsed = rescheduleTaskSchema.parse(body);
    const oldDue = access.task.dueAt;
    const oldIso = oldDue?.toISOString() ?? null;
    const newDue =
      parsed.newDueAt === null ? null : new Date(parsed.newDueAt);
    const newIso = newDue?.toISOString() ?? null;

    if (oldIso === newIso) {
      return this.taskMutationResult(userId, taskId, []);
    }

    const ledgerDelta: (typeof activityLedger.$inferSelect)[] = [];
    await this.db.transaction(async (tx) => {
      await tx
        .update(tasks)
        .set({ dueAt: newDue, updatedAt: new Date() })
        .where(eq(tasks.id, taskId));
      const [row] = await tx
        .insert(activityLedger)
        .values({
          taskId,
          actorId: userId,
          type: "reschedule",
          payload: {
            oldDueAt: oldIso,
            newDueAt: newIso,
            reason: parsed.reason,
          },
        })
        .returning();
      ledgerDelta.push(row!);
    });

    const rescheduled = await this.taskMutationResult(userId, taskId, ledgerDelta);
    this.collaboration.notifyOrgChanged(access.task.organizationId, taskId);
    return rescheduled;
  }

  async archive(userId: string, taskId: string) {
    const access = await this.authz.getTaskAccess(userId, taskId);
    if (access.task.deletedAt) {
      throw new ForbiddenException("Task already archived");
    }
    const isAssigner = access.task.assignerId === userId;
    if (!access.isOwner && !access.isDeptManager && !isAssigner) {
      throw new ForbiddenException(
        "Only owners, department managers, or the task creator can delete tasks",
      );
    }

    const now = new Date();
    const ledgerDelta: (typeof activityLedger.$inferSelect)[] = [];
    await this.db.transaction(async (tx) => {
      await tx
        .update(tasks)
        .set({ deletedAt: now, updatedAt: now })
        .where(eq(tasks.id, taskId));
      const [row] = await tx
        .insert(activityLedger)
        .values({
          taskId,
          actorId: userId,
          type: "archive",
          payload: { archivedAt: now.toISOString() },
        })
        .returning();
      ledgerDelta.push(row!);
    });

    const archived = await this.taskMutationResult(userId, taskId, ledgerDelta);
    this.collaboration.notifyOrgChanged(access.task.organizationId, taskId);
    return archived;
  }

  async deleteTask(userId: string, taskId: string) {
    const access = await this.authz.getTaskAccess(userId, taskId);
    const caps = this.authz.taskCapabilities(access, userId);
    if (!caps.canDeleteTask) {
      throw new ForbiddenException("Only owners and task creators can permanently delete tasks");
    }
    const orgId = access.task.organizationId;
    await this.db.delete(tasks).where(eq(tasks.id, taskId));
    this.collaboration.notifyOrgChanged(orgId, taskId);
  }

  async updateStatus(userId: string, taskId: string, body: unknown) {
    const parsed = updateTaskStatusSchema.parse(body);
    return this.patchTask(userId, taskId, { status: parsed.status });
  }

  async patchTask(userId: string, taskId: string, body: unknown) {
    const access = await this.authz.getTaskAccess(userId, taskId);
    const caps = this.authz.taskCapabilities(access, userId);
    if (!caps.canAppendLedger) throw new ForbiddenException("Cannot update task");

    const parsed = patchTaskSchema.parse(body);
    const task = access.task;
    const orgId = task.organizationId;

    const subtasksToCreate = parsed.subtasksToCreate ?? [];
    const subtasksToUpdate = parsed.subtasksToUpdate ?? [];
    const subtasksToDelete = parsed.subtasksToDelete ?? [];
    const hasSubtasksCreate = subtasksToCreate.length > 0;
    const hasSubtasksUpdate = subtasksToUpdate.length > 0;
    const hasSubtasksDelete = subtasksToDelete.length > 0;
    const hasSubtasksChange = hasSubtasksCreate || hasSubtasksUpdate || hasSubtasksDelete;

    const oldStatus = task.status;
    const oldPriority = task.priority;
    const nextStatus = parsed.status !== undefined ? parsed.status : oldStatus;
    const nextPriority = parsed.priority !== undefined ? parsed.priority : oldPriority;
    const statusChanged = parsed.status !== undefined && parsed.status !== oldStatus;
    const priorityChanged = parsed.priority !== undefined && parsed.priority !== oldPriority;
    const titleChanged = parsed.title !== undefined && parsed.title !== task.title;
    const assigneesChanged = parsed.assigneeUserIds !== undefined;

    const oldDueIso = task.dueAt?.toISOString() ?? null;
    const nextDueIso: string | null | undefined =
      parsed.dueAt === undefined ? undefined : parsed.dueAt === null ? null : new Date(parsed.dueAt).toISOString();
    const dueChanged =
      parsed.dueAt !== undefined &&
      (nextDueIso === undefined ? false : oldDueIso !== nextDueIso);

    const dueCleared = parsed.dueAt !== undefined && parsed.dueAt === null;
    const nextRepeat =
      dueCleared ? null : parsed.dueRepeat !== undefined ? (parsed.dueRepeat ?? null) : (task.dueRepeat ?? null);
    const repeatChanged = (task.dueRepeat ?? null) !== nextRepeat;

    const hasTaskFieldUpdates =
      statusChanged || priorityChanged || titleChanged || assigneesChanged || dueChanged || repeatChanged;

    if (!hasTaskFieldUpdates && !hasSubtasksChange) {
      return this.taskMutationResult(userId, taskId, []);
    }

    if (dueChanged && !caps.canReschedule) throw new ForbiddenException("Cannot update due date");

    if (assigneesChanged && parsed.assigneeUserIds && parsed.assigneeUserIds.length > 0) {
      const ids = [...new Set(parsed.assigneeUserIds)];
      const rows = await this.db
        .select({ userId: organizationMembers.userId })
        .from(organizationMembers)
        .where(and(eq(organizationMembers.organizationId, orgId), inArray(organizationMembers.userId, ids)));
      if (rows.length !== ids.length) {
        throw new ForbiddenException("Invalid assignee selection");
      }
    }

    const previousAssigneeSorted = assigneesChanged
      ? (
          await this.db
            .select({ userId: taskAssignees.userId })
            .from(taskAssignees)
            .where(eq(taskAssignees.taskId, taskId))
        )
          .map((r) => r.userId)
          .sort()
      : ([] as string[]);
    const nextAssigneeSorted = assigneesChanged ? [...new Set(parsed.assigneeUserIds!)].sort() : ([] as string[]);
    const assigneesActuallyChanged =
      assigneesChanged && JSON.stringify(previousAssigneeSorted) !== JSON.stringify(nextAssigneeSorted);

    const ledgerDelta: (typeof activityLedger.$inferSelect)[] = [];
    const now = new Date();
    const preDue = task.dueAt;
    const preRepeat = task.dueRepeat;
    let spawnedRecurringTaskId: string | undefined;

    await this.db.transaction(async (tx) => {
      if (hasTaskFieldUpdates) {
        await tx
          .update(tasks)
          .set({
            ...(parsed.status !== undefined ? { status: nextStatus } : {}),
            ...(parsed.priority !== undefined ? { priority: nextPriority } : {}),
            ...(parsed.title !== undefined ? { title: parsed.title } : {}),
            ...(dueChanged ? { dueAt: parsed.dueAt === null ? null : new Date(parsed.dueAt!) } : {}),
            ...(repeatChanged ? { dueRepeat: nextRepeat } : {}),
            updatedAt: now,
          })
          .where(eq(tasks.id, taskId));

        if (assigneesChanged) {
          await tx.delete(taskAssignees).where(eq(taskAssignees.taskId, taskId));
          const ids = parsed.assigneeUserIds!;
          if (ids.length > 0) {
            await tx
              .insert(taskAssignees)
              .values(ids.map((uid) => ({ taskId, userId: uid })))
              .onConflictDoNothing({ target: [taskAssignees.taskId, taskAssignees.userId] });
          }
        }

        if (dueChanged) {
          const [row] = await tx
            .insert(activityLedger)
            .values({
              taskId,
              actorId: userId,
              type: "reschedule",
              payload: {
                oldDueAt: oldDueIso,
                newDueAt: nextDueIso!,
                reason: "Due updated via task edit",
              },
            })
            .returning();
          ledgerDelta.push(row!);
        }

        if (statusChanged) {
          const [row] = await tx
            .insert(activityLedger)
            .values({
              taskId,
              actorId: userId,
              type: "status_change",
              payload: {
                oldStatus,
                newStatus: parsed.status,
              },
            })
            .returning();
          ledgerDelta.push(row!);
        }

        if (assigneesActuallyChanged) {
          const [row] = await tx
            .insert(activityLedger)
            .values({
              taskId,
              actorId: userId,
              type: "assignee_change",
              payload: {
                previousAssigneeUserIds: previousAssigneeSorted,
                assigneeUserIds: nextAssigneeSorted,
              },
            })
            .returning();
          ledgerDelta.push(row!);
        }

        if (priorityChanged) {
          const [row] = await tx
            .insert(activityLedger)
            .values({
              taskId,
              actorId: userId,
              type: "priority_change",
              payload: { oldPriority, newPriority: nextPriority },
            })
            .returning();
          ledgerDelta.push(row!);
        }

        if (titleChanged) {
          const [row] = await tx
            .insert(activityLedger)
            .values({
              taskId,
              actorId: userId,
              type: "note",
              payload: { message: "Title updated." },
            })
            .returning();
          ledgerDelta.push(row!);
        }
      } else if (hasSubtasksChange) {
        await tx.update(tasks).set({ updatedAt: now }).where(eq(tasks.id, taskId));
      }

      if (hasSubtasksCreate) {
        await tx.insert(subtasks).values(subtasksToCreate.map((s) => ({ taskId, title: s.title })));
      }

      if (hasSubtasksUpdate) {
        for (const s of subtasksToUpdate) {
          await tx
            .update(subtasks)
            .set({ title: s.title })
            .where(and(eq(subtasks.id, s.id), eq(subtasks.taskId, taskId)));
        }
      }

      if (hasSubtasksDelete) {
        await tx
          .delete(subtasks)
          .where(and(eq(subtasks.taskId, taskId), inArray(subtasks.id, subtasksToDelete)));
      }

      if (
        statusChanged &&
        parsed.status === "done" &&
        !dueCleared &&
        preDue &&
        isDueRepeat(preRepeat)
      ) {
        const [existingChild] = await tx
          .select({ id: tasks.id })
          .from(tasks)
          .where(eq(tasks.spawnedFromTaskId, taskId))
          .limit(1);
        if (!existingChild) {
          const nextDue = computeNextDue(preDue, preRepeat);
          const seriesId = task.recurringSeriesId ?? task.id;
          const nextTitle = parsed.title !== undefined ? parsed.title : task.title;
          const nextPri = parsed.priority !== undefined ? parsed.priority : task.priority;
          const [spawned] = await tx
            .insert(tasks)
            .values({
              organizationId: orgId,
              listId: task.listId,
              assignerId: task.assignerId,
              title: nextTitle,
              status: "pending",
              priority: nextPri,
              dueAt: nextDue,
              dueRepeat: preRepeat,
              recurringSeriesId: seriesId,
              spawnedFromTaskId: taskId,
            })
            .returning();
          const newId = spawned!.id;
          spawnedRecurringTaskId = newId;

          const curAssignees = await tx
            .select({ userId: taskAssignees.userId })
            .from(taskAssignees)
            .where(eq(taskAssignees.taskId, taskId));
          const sortedAssignees = [...new Set(curAssignees.map((r) => r.userId))];
          if (sortedAssignees.length > 0) {
            await tx
              .insert(taskAssignees)
              .values(sortedAssignees.map((uid) => ({ taskId: newId, userId: uid })))
              .onConflictDoNothing({ target: [taskAssignees.taskId, taskAssignees.userId] });
          }

          await tx.insert(activityLedger).values({
            taskId: newId,
            actorId: userId,
            type: "note",
            payload: { message: "Task created.", title: nextTitle },
          });

          if (sortedAssignees.length > 0) {
            await tx.insert(activityLedger).values({
              taskId: newId,
              actorId: userId,
              type: "assignee_change",
              payload: {
                previousAssigneeUserIds: [] as string[],
                assigneeUserIds: [...sortedAssignees].sort(),
              },
            });
          }

          const [parentNote] = await tx
            .insert(activityLedger)
            .values({
              taskId,
              actorId: userId,
              type: "note",
              payload: { message: "Next occurrence created.", spawnedTaskId: newId },
            })
            .returning();
          ledgerDelta.push(parentNote!);
        }
      }
    });

    const base = await this.taskMutationResult(userId, taskId, ledgerDelta);
    this.collaboration.notifyOrgChanged(orgId, taskId);
    return spawnedRecurringTaskId ? { ...base, spawnedRecurringTaskId } : base;
  }

  /** Slim write response: task row + assignees + subtasks + caps + ledger rows created in this request (no full ledger load). */
  private async taskMutationResult(
    userId: string,
    taskId: string,
    ledgerDelta: (typeof activityLedger.$inferSelect)[],
  ) {
    await this.applyAutomationForTaskId(taskId);
    const access = await this.authz.getTaskAccess(userId, taskId);
    const caps = this.authz.taskCapabilities(access, userId);

    const [assignees, taskSubtasks, latestLedgerRows] = await Promise.all([
      this.db
        .select({ userId: taskAssignees.userId })
        .from(taskAssignees)
        .where(eq(taskAssignees.taskId, taskId)),
      this.db.select().from(subtasks).where(eq(subtasks.taskId, taskId)).orderBy(asc(subtasks.createdAt)),
      this.db
        .select()
        .from(activityLedger)
        .where(eq(activityLedger.taskId, taskId))
        .orderBy(desc(activityLedger.createdAt))
        .limit(1),
    ]);

    const latestLedger = latestLedgerRows[0] ?? null;

    if (ledgerDelta.length > 0) {
      void this.pushNotifications
        .notifyLedgerActivity({
          organizationId: access.task.organizationId,
          actorUserId: userId,
          taskId,
          taskTitle: access.task.title,
          assignerUserId: access.task.assignerId,
          assigneeUserIds: assignees.map((a) => a.userId),
          ledgerDelta,
        })
        .catch(() => {});
    }

    return {
      task: { ...access.task, lastLedger: latestLedger },
      capabilities: caps,
      assigneeUserIds: assignees.map((a) => a.userId),
      subtasks: taskSubtasks,
      ledgerDelta,
    };
  }

  /** Ledger note + push for subtask-only updates (and similar lightweight activity). */
  private async recordTaskActivityNote(
    userId: string,
    taskId: string,
    message: string,
    extra?: Record<string, unknown>,
  ) {
    const access = await this.authz.getTaskAccess(userId, taskId);
    const [entry] = await this.db
      .insert(activityLedger)
      .values({
        taskId,
        actorId: userId,
        type: "note",
        payload: { message, ...extra },
      })
      .returning();

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
        ledgerDelta: [entry!],
      })
      .catch(() => {});

    this.collaboration.notifyOrgChanged(access.task.organizationId, taskId);
    return entry!;
  }

  /** One-off normalize of legacy `assigned` / `late` rows (no ledger rows). */
  private async applyAutomationForTaskId(taskId: string): Promise<void> {
    const [row] = await this.db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    if (!row || row.deletedAt != null) return;

    const next = coerceLegacyTaskStatus(row.status);
    if (next === row.status) return;

    const now = new Date();
    await this.db
      .update(tasks)
      .set({ status: next as typeof row.status, updatedAt: now })
      .where(eq(tasks.id, taskId));
  }

  private async syncAutomatedStatuses<T extends { id: string; status: string }>(rows: T[]): Promise<T[]> {
    if (rows.length === 0) return rows;
    const updates: { id: string; status: string }[] = [];
    for (const row of rows) {
      const next = coerceLegacyTaskStatus(row.status);
      if (next !== row.status) updates.push({ id: row.id, status: next });
    }
    if (updates.length === 0) return rows;

    await this.db.transaction(async (tx) => {
      const tnow = new Date();
      for (const u of updates) {
        await tx
          .update(tasks)
          .set({ status: u.status as (typeof tasks.$inferSelect)["status"], updatedAt: tnow })
          .where(eq(tasks.id, u.id));
      }
    });

    const map = new Map(updates.map((u) => [u.id, u.status]));
    return rows.map((r) => (map.has(r.id) ? { ...r, status: map.get(r.id)! } : r));
  }

  async buildTaskPdf(userId: string, taskId: string): Promise<Uint8Array> {
    const detail = await this.getDetail(userId, taskId);
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const mono = await doc.embedFont(StandardFonts.Courier);
    let page = doc.addPage([612, 792]);
    const margin = 50;
    let y = 750;
    const line = (text: string, size = 11, useMono = false) => {
      if (y < margin + 40) {
        page = doc.addPage([612, 792]);
        y = 750;
      }
      page.drawText(text.slice(0, 120), {
        x: margin,
        y,
        size,
        font: useMono ? mono : font,
      });
      y -= size + 6;
    };

    line("LogBase — Task report", 14);
    line(`Task: ${detail.task.title}`, 12);
    line(`Task ID: ${detail.task.id}`, 10, true);
    line(`Status: ${detail.task.status}`, 10);
    line(`Due: ${detail.task.dueAt?.toISOString() ?? "—"}`, 10, true);
    if (detail.task.dueRepeat) {
      line(`Repeat: ${detail.task.dueRepeat}`, 10);
    }
    line(`Assigner: ${detail.task.assignerId}`, 10, true);
    line("", 8);
    line("Activity ledger (newest last in file = we print oldest first)", 10);
    const chronological = [...detail.ledger].reverse();
    for (const row of chronological) {
      const ts = row.createdAt.toISOString();
      line(`${ts}  [${row.type}]  ${row.actorId}`, 9, true);
      line(JSON.stringify(row.payload).slice(0, 200), 8);
    }

    return doc.save();
  }
}
