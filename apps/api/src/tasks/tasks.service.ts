import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import {
  appendLedgerSchema,
  createTaskSchema,
  rescheduleTaskSchema,
} from "@work-ledger/contracts";
import { activityLedger, taskAssignees, tasks } from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { AuthorizationService } from "../authorization/authorization.service";
import { DRIZZLE } from "../db/drizzle.constants";
import { DepartmentsService } from "../departments/departments.service";
import { PDFDocument, StandardFonts } from "pdf-lib";

@Injectable()
export class TasksService {
  constructor(
    @Inject(DRIZZLE) private readonly db: AppDatabase,
    private readonly authz: AuthorizationService,
    private readonly departments: DepartmentsService,
  ) {}

  async list(userId: string, organizationId: string) {
    return this.authz.listTasksForUser(userId, organizationId);
  }

  async create(userId: string, organizationId: string, body: unknown) {
    await this.authz.assertOrgMember(userId, organizationId);
    const parsed = createTaskSchema.parse(body);
    await this.departments.assertDeptInOrg(organizationId, parsed.departmentId);

    const [task] = await this.db
      .insert(tasks)
      .values({
        organizationId,
        departmentId: parsed.departmentId,
        assignerId: userId,
        title: parsed.title,
        dueAt: parsed.dueAt ? new Date(parsed.dueAt) : null,
      })
      .returning();

    if (parsed.assigneeUserIds?.length) {
      const rows = parsed.assigneeUserIds.map((uid) => ({
        taskId: task.id,
        userId: uid,
      }));
      await this.db
        .insert(taskAssignees)
        .values(rows)
        .onConflictDoNothing({ target: [taskAssignees.taskId, taskAssignees.userId] });
    }

    await this.db.insert(activityLedger).values({
      taskId: task.id,
      actorId: userId,
      type: "note",
      payload: { message: "Task created.", title: parsed.title },
    });

    return this.getDetail(userId, task.id);
  }

  async getDetail(userId: string, taskId: string) {
    const access = await this.authz.getTaskAccess(userId, taskId);
    const caps = this.authz.taskCapabilities(access, userId);

    const [assignees, ledger] = await Promise.all([
      this.db
        .select({ userId: taskAssignees.userId })
        .from(taskAssignees)
        .where(eq(taskAssignees.taskId, taskId)),
      this.db
        .select()
        .from(activityLedger)
        .where(eq(activityLedger.taskId, taskId))
        .orderBy(desc(activityLedger.createdAt)),
    ]);

    return {
      task: access.task,
      capabilities: caps,
      assigneeUserIds: assignees.map((a) => a.userId),
      ledger,
    };
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

    return { idempotent: false as const, entry: entry! };
  }

  async reschedule(userId: string, taskId: string, body: unknown) {
    const access = await this.authz.getTaskAccess(userId, taskId);
    const caps = this.authz.taskCapabilities(access, userId);
    if (!caps.canReschedule) throw new ForbiddenException("Cannot reschedule");

    const parsed = rescheduleTaskSchema.parse(body);
    const newDue = new Date(parsed.newDueAt);
    const oldDue = access.task.dueAt;

    await this.db.transaction(async (tx) => {
      await tx
        .update(tasks)
        .set({ dueAt: newDue, updatedAt: new Date() })
        .where(eq(tasks.id, taskId));
      await tx.insert(activityLedger).values({
        taskId,
        actorId: userId,
        type: "reschedule",
        payload: {
          oldDueAt: oldDue?.toISOString() ?? null,
          newDueAt: newDue.toISOString(),
          reason: parsed.reason,
        },
      });
    });

    return this.getDetail(userId, taskId);
  }

  async archive(userId: string, taskId: string) {
    await this.authz.getTaskAccess(userId, taskId);

    const now = new Date();
    await this.db.transaction(async (tx) => {
      await tx
        .update(tasks)
        .set({ deletedAt: now, updatedAt: now })
        .where(eq(tasks.id, taskId));
      await tx.insert(activityLedger).values({
        taskId,
        actorId: userId,
        type: "archive",
        payload: { archivedAt: now.toISOString() },
      });
    });

    return this.getDetail(userId, taskId);
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

    line("Work Ledger — Task report", 14);
    line(`Task: ${detail.task.title}`, 12);
    line(`Task ID: ${detail.task.id}`, 10, true);
    line(`Status: ${detail.task.status}`, 10);
    line(`Due: ${detail.task.dueAt?.toISOString() ?? "—"}`, 10, true);
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
