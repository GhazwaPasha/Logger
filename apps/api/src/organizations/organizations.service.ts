import { randomBytes } from "node:crypto";
import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  upsertOrganizationMemberSchema,
} from "@work-ledger/contracts";
import {
  activityLedger,
  organizationMemberManagedDepartments,
  organizationMembers,
  organizations,
  user,
} from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { DRIZZLE } from "../db/drizzle.constants";
import { AuthorizationService } from "../authorization/authorization.service";
import { DepartmentsService } from "../departments/departments.service";
import { ListsService } from "../lists/lists.service";
import { CollaborationService } from "../realtime/collaboration.service";
import { TasksService } from "../tasks/tasks.service";

const RESERVED_SLUGS = new Set(["app", "login", "audit", "api", "_next", "workspaces"]);

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: AppDatabase,
    private readonly authz: AuthorizationService,
    private readonly departments: DepartmentsService,
    private readonly lists: ListsService,
    private readonly tasks: TasksService,
    private readonly collaboration: CollaborationService,
  ) {}

  private slugifyName(name: string): string {
    const base = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
    return base.length >= 2 ? base : "workspace";
  }

  private async allocateSlug(base: string): Promise<string> {
    for (let i = 0; i < 40; i++) {
      const candidate = i === 0 ? base : `${base}-${randomBytes(3).toString("hex")}`;
      if (RESERVED_SLUGS.has(candidate)) continue;
      const rows = await this.db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, candidate)).limit(1);
      if (rows.length === 0) return candidate;
    }
    throw new Error("Could not allocate organization slug");
  }

  async listForUser(userId: string) {
    const ids = await this.authz.listOrganizationIdsForUser(userId);
    if (ids.length === 0) return [];
    return this.db.select().from(organizations).where(inArray(organizations.id, ids));
  }

  async create(userId: string, body: unknown) {
    const parsed = createOrganizationSchema.parse(body);
    const base = this.slugifyName(parsed.name);
    const slug = await this.allocateSlug(base);
    const [org] = await this.db.insert(organizations).values({ name: parsed.name, slug }).returning();
    await this.db.insert(organizationMembers).values({
      organizationId: org.id,
      userId: userId,
      role: "owner",
    });
    this.collaboration.notifyOrgChanged(org.id, null);
    return org;
  }

  async getById(userId: string, organizationId: string) {
    await this.authz.assertOrgMember(userId, organizationId);
    const rows = await this.db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
    const org = rows[0];
    if (!org) throw new NotFoundException("Organization not found");
    return org;
  }

  /**
   * Activity ledger across all tasks the user can see in this org (same rules as task list),
   * newest first. Caps at 500 rows per request.
   */
  async activityFeed(userId: string, organizationId: string, opts?: { limit?: number }) {
    await this.authz.assertOrgMember(userId, organizationId);
    const raw = opts?.limit;
    const limit =
      typeof raw === "number" && Number.isFinite(raw)
        ? Math.min(Math.max(Math.floor(raw), 1), 500)
        : 150;

    const taskRows = await this.tasks.list(userId, organizationId, { includeSubtasks: false });
    const taskIds = taskRows.map((t) => t.id);
    const tasksById = Object.fromEntries(taskRows.map((t) => [t.id, { id: t.id, title: t.title }]));

    if (taskIds.length === 0) {
      return { entries: [], tasksById: {} };
    }

    const rows = await this.db
      .select({
        id: activityLedger.id,
        taskId: activityLedger.taskId,
        actorId: activityLedger.actorId,
        type: activityLedger.type,
        payload: activityLedger.payload,
        clientMutationId: activityLedger.clientMutationId,
        createdAt: activityLedger.createdAt,
      })
      .from(activityLedger)
      .where(inArray(activityLedger.taskId, taskIds))
      .orderBy(desc(activityLedger.createdAt))
      .limit(limit);

    return { entries: rows, tasksById };
  }

  /** Single round-trip workspace payload for app shell (parallel DB reads). */
  async workspaceBootstrap(userId: string, organizationId: string) {
    const [departments, lists, taskRows, members] = await Promise.all([
      this.departments.list(userId, organizationId),
      this.lists.list(userId, organizationId),
      /** One batched subtasks query (see `attachSubtasks`); avoids N+1 `GET /tasks/:id/subtasks` from the web board. */
      this.tasks.list(userId, organizationId, { includeSubtasks: true }),
      this.listMembers(userId, organizationId),
    ]);
    return { departments, lists, tasks: taskRows, members };
  }

  async patch(userId: string, organizationId: string, body: unknown) {
    const membership = await this.authz.assertOrgMember(userId, organizationId);
    if (membership.role !== "owner") {
      throw new ForbiddenException("Only owners can rename this workspace");
    }
    const parsed = updateOrganizationSchema.parse(body);
    const [row] = await this.db
      .update(organizations)
      .set({ name: parsed.name })
      .where(eq(organizations.id, organizationId))
      .returning();
    if (!row) throw new NotFoundException("Organization not found");
    this.collaboration.notifyOrgChanged(organizationId, null);
    return row;
  }

  /** Owner only. Cascades members, levels, lists, tasks (FK). */
  async remove(userId: string, organizationId: string) {
    const membership = await this.authz.assertOrgMember(userId, organizationId);
    if (membership.role !== "owner") {
      throw new ForbiddenException("Only owners can delete this organization");
    }
    const rows = await this.db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
    if (rows.length === 0) throw new NotFoundException("Organization not found");
    this.collaboration.notifyOrgChanged(organizationId, null);
    await this.db.delete(organizations).where(eq(organizations.id, organizationId));
  }

  async listMembers(requesterId: string, organizationId: string) {
    await this.authz.assertOrgMember(requesterId, organizationId);
    const rows = await this.db
      .select({
        memberId: organizationMembers.id,
        userId: organizationMembers.userId,
        role: organizationMembers.role,
        departmentId: organizationMembers.departmentId,
        email: user.email,
        name: user.name,
        image: user.image,
      })
      .from(organizationMembers)
      .innerJoin(user, eq(organizationMembers.userId, user.id))
      .where(eq(organizationMembers.organizationId, organizationId));

    const managerIds = rows.filter((r) => r.role === "manager").map((r) => r.memberId);
    const managedMap = new Map<string, string[]>();
    if (managerIds.length > 0) {
      const junctionRows = await this.db
        .select()
        .from(organizationMemberManagedDepartments)
        .where(inArray(organizationMemberManagedDepartments.organizationMemberId, managerIds));
      for (const j of junctionRows) {
        const prev = managedMap.get(j.organizationMemberId) ?? [];
        prev.push(j.departmentId);
        managedMap.set(j.organizationMemberId, prev);
      }
    }

    return rows.map((r) => {
      const fromJunction = managedMap.get(r.memberId) ?? [];
      const managedDepartmentIds =
        r.role === "manager"
          ? fromJunction.length > 0
            ? fromJunction
            : r.departmentId
              ? [r.departmentId]
              : []
          : [];
      return {
        userId: r.userId,
        role: r.role,
        departmentId: managedDepartmentIds[0] ?? null,
        managedDepartmentIds,
        email: r.email,
        name: r.name,
        image: r.image,
      };
    });
  }

  async removeMember(requesterId: string, organizationId: string, targetUserId: string) {
    const membership = await this.authz.assertOrgMember(requesterId, organizationId);
    if (membership.role !== "owner") {
      throw new ForbiddenException("Only owners can remove members");
    }
    if (requesterId === targetUserId) {
      throw new ForbiddenException("Cannot remove yourself from the workspace");
    }
    const rows = await this.db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, targetUserId)))
      .limit(1);
    const member = rows[0];
    if (!member) throw new NotFoundException("Member not found");
    await this.db
      .delete(organizationMemberManagedDepartments)
      .where(eq(organizationMemberManagedDepartments.organizationMemberId, member.id));
    await this.db.delete(organizationMembers).where(eq(organizationMembers.id, member.id));
    this.collaboration.notifyOrgChanged(organizationId, null);
  }

  async upsertMemberByEmail(requesterId: string, organizationId: string, body: unknown) {
    const membership = await this.authz.assertOrgMember(requesterId, organizationId);
    if (membership.role !== "owner") {
      throw new ForbiddenException("Only owners can add or update members");
    }
    const parsed = upsertOrganizationMemberSchema.parse(body);
    const emailLower = parsed.email.trim().toLowerCase();

    const targetRows = await this.db
      .select()
      .from(user)
      .where(sql`lower(${user.email}) = ${emailLower}`)
      .limit(1);
    const targetUser = targetRows[0];
    if (!targetUser) throw new NotFoundException("No user registered with that email");

    const managerDeptIds =
      parsed.role === "manager"
        ? [
            ...new Set(
              parsed.departmentIds?.length
                ? parsed.departmentIds
                : parsed.departmentId
                  ? [parsed.departmentId]
                  : [],
            ),
          ]
        : [];
    if (parsed.role === "manager") {
      for (const deptId of managerDeptIds) {
        await this.departments.assertDeptInOrg(organizationId, deptId);
      }
    }

    const primaryDeptId = parsed.role === "manager" ? (managerDeptIds[0] ?? null) : null;

    const [memberRow] = await this.db
      .insert(organizationMembers)
      .values({
        organizationId,
        userId: targetUser.id,
        role: parsed.role,
        departmentId: primaryDeptId,
      })
      .onConflictDoUpdate({
        target: [organizationMembers.organizationId, organizationMembers.userId],
        set: {
          role: parsed.role,
          departmentId: primaryDeptId,
        },
      })
      .returning({ id: organizationMembers.id });

    await this.db
      .delete(organizationMemberManagedDepartments)
      .where(eq(organizationMemberManagedDepartments.organizationMemberId, memberRow.id));

    if (parsed.role === "manager" && managerDeptIds.length > 0) {
      await this.db.insert(organizationMemberManagedDepartments).values(
        managerDeptIds.map((departmentId) => ({
          organizationMemberId: memberRow.id,
          departmentId,
        })),
      );
    }

    this.collaboration.notifyOrgChanged(organizationId, null);
    return this.listMembers(requesterId, organizationId);
  }
}
