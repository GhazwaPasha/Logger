import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { formatZonedDateKey } from "@work-ledger/contracts";
import { activityLedger, departments, lists, organizationMembers, taskAssignees, tasks, user } from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { DRIZZLE } from "../db/drizzle.constants";
import { AuthorizationService } from "../authorization/authorization.service";
import { getOrganizationTimeZone } from "../db/org-timezone.util";
import { PerformanceService } from "../performance/performance.service";

function escapeCsv(val: unknown): string {
  const s = val == null ? "" : String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsvRow(cols: unknown[]): string {
  return cols.map(escapeCsv).join(",");
}

@Injectable()
export class ReportsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: AppDatabase,
    private readonly authz: AuthorizationService,
    private readonly performance: PerformanceService,
  ) {}

  async exportTasksCsv(
    userId: string,
    organizationId: string,
    opts?: { dateFrom?: string; dateTo?: string; deptId?: string; status?: string },
  ): Promise<string> {
    const taskIds = await this.authz.listTaskIdsForUser(userId, organizationId);
    if (taskIds.length === 0) return "";

    const timeZone = await getOrganizationTimeZone(this.db, organizationId);
    const conditions = [inArray(tasks.id, taskIds), isNull(tasks.deletedAt)];
    if (opts?.status) conditions.push(eq(tasks.status, opts.status as any));
    if (opts?.dateFrom) conditions.push(gte(tasks.createdAt, new Date(opts.dateFrom)));
    if (opts?.dateTo) conditions.push(lte(tasks.createdAt, new Date(opts.dateTo)));

    const rows = await this.db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        dueAt: tasks.dueAt,
        createdAt: tasks.createdAt,
        listId: tasks.listId,
      })
      .from(tasks)
      .where(and(...conditions))
      .orderBy(tasks.createdAt);

    if (rows.length === 0) return "";

    const taskIdList = rows.map((r) => r.id);

    const [assigneeRows, listRows] = await Promise.all([
      this.db
        .select({ taskId: taskAssignees.taskId, email: user.email, name: user.name })
        .from(taskAssignees)
        .innerJoin(user, eq(taskAssignees.userId, user.id))
        .where(inArray(taskAssignees.taskId, taskIdList)),
      this.db
        .select({ id: lists.id, name: lists.name, departmentId: lists.departmentId })
        .from(lists)
        .where(eq(lists.organizationId, organizationId)),
    ]);

    const deptRows = await this.db
      .select({ id: departments.id, name: departments.name })
      .from(departments)
      .where(eq(departments.organizationId, organizationId));

    const assigneesByTask = new Map<string, string[]>();
    for (const a of assigneeRows) {
      const prev = assigneesByTask.get(a.taskId) ?? [];
      prev.push(a.name ?? a.email);
      assigneesByTask.set(a.taskId, prev);
    }

    const listsById = new Map(listRows.map((l) => [l.id, l]));
    const deptsById = new Map(deptRows.map((d) => [d.id, d]));

    const header = toCsvRow(["ID", "Title", "Status", "Priority", "Department", "List", "Assignees", "Due Date", "Created At"]);
    const dataRows = rows.map((r) => {
      const list = listsById.get(r.listId);
      const dept = list?.departmentId ? deptsById.get(list.departmentId) : undefined;
      return toCsvRow([
        r.id,
        r.title,
        r.status,
        r.priority,
        dept?.name ?? "",
        list?.name ?? "",
        (assigneesByTask.get(r.id) ?? []).join("; "),
        r.dueAt ? formatZonedDateKey(new Date(r.dueAt), timeZone) : "",
        formatZonedDateKey(new Date(r.createdAt), timeZone),
      ]);
    });

    return [header, ...dataRows].join("\n");
  }

  async exportActivityCsv(
    userId: string,
    organizationId: string,
    opts?: { dateFrom?: string; dateTo?: string },
  ): Promise<string> {
    const taskIds = await this.authz.listTaskIdsForUser(userId, organizationId);
    if (taskIds.length === 0) return "";

    const conditions = [inArray(activityLedger.taskId, taskIds)];
    if (opts?.dateFrom) conditions.push(gte(activityLedger.createdAt, new Date(opts.dateFrom)));
    if (opts?.dateTo) conditions.push(lte(activityLedger.createdAt, new Date(opts.dateTo)));

    const rows = await this.db
      .select({
        id: activityLedger.id,
        taskId: activityLedger.taskId,
        actorId: activityLedger.actorId,
        type: activityLedger.type,
        createdAt: activityLedger.createdAt,
        actorEmail: user.email,
        actorName: user.name,
      })
      .from(activityLedger)
      .innerJoin(user, eq(activityLedger.actorId, user.id))
      .where(and(...conditions))
      .orderBy(activityLedger.createdAt)
      .limit(5000);

    const header = toCsvRow(["ID", "Task ID", "Actor", "Type", "Created At"]);
    const dataRows = rows.map((r) =>
      toCsvRow([
        r.id,
        r.taskId,
        r.actorName ?? r.actorEmail,
        r.type,
        new Date(r.createdAt).toISOString(),
      ]),
    );

    return [header, ...dataRows].join("\n");
  }

  async exportPerformanceCsv(
    userId: string,
    organizationId: string,
    opts?: { dateFrom?: string; dateTo?: string },
  ): Promise<string> {
    const { members } = await this.performance.scorecards(userId, organizationId, opts);
    if (members.length === 0) return "";

    const header = toCsvRow([
      "Name",
      "Email",
      "Role",
      "Completed",
      "On Time",
      "Late",
      "On-Time Rate",
      "Pending",
      "In Progress",
      "Time Logged (hrs)",
      "Required Submissions",
      "Required Submissions Fulfilled",
      "Required Submission Rate",
      "Optional Submissions",
      "Optional Submissions Fulfilled",
      "Attachments Required",
      "Attachments Fulfilled",
      "Attachment Rate",
    ]);
    const dataRows = members.map((m) =>
      toCsvRow([
        m.name ?? m.email,
        m.email,
        m.role,
        m.completed,
        m.onTime,
        m.late,
        `${Math.round(m.onTimeRate * 100)}%`,
        m.pending,
        m.inProgress,
        (m.timeLoggedSeconds / 3600).toFixed(2),
        m.submissionsRequired,
        m.submissionsFulfilled,
        `${Math.round(m.submissionRate * 100)}%`,
        m.submissionsOptional,
        m.submissionsOptionalFulfilled,
        m.attachmentsRequired,
        m.attachmentsFulfilled,
        `${Math.round(m.attachmentRate * 100)}%`,
      ]),
    );

    return [header, ...dataRows].join("\n");
  }
}
