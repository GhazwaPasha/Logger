import { randomBytes } from "node:crypto";
import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq, inArray, sql } from "drizzle-orm";
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  upsertOrganizationMemberSchema,
} from "@work-ledger/contracts";
import { organizationMembers, organizations, user } from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { DRIZZLE } from "../db/drizzle.constants";
import { AuthorizationService } from "../authorization/authorization.service";
import { DepartmentsService } from "../departments/departments.service";
import { ListsService } from "../lists/lists.service";
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
    return org;
  }

  async getById(userId: string, organizationId: string) {
    await this.authz.assertOrgMember(userId, organizationId);
    const rows = await this.db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
    const org = rows[0];
    if (!org) throw new NotFoundException("Organization not found");
    return org;
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
    return row;
  }

  async listMembers(requesterId: string, organizationId: string) {
    await this.authz.assertOrgMember(requesterId, organizationId);
    return this.db
      .select({
        userId: organizationMembers.userId,
        role: organizationMembers.role,
        departmentId: organizationMembers.departmentId,
        email: user.email,
        name: user.name,
      })
      .from(organizationMembers)
      .innerJoin(user, eq(organizationMembers.userId, user.id))
      .where(eq(organizationMembers.organizationId, organizationId));
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

    if (parsed.role === "manager") {
      await this.departments.assertDeptInOrg(organizationId, parsed.departmentId!);
    }

    const deptId = parsed.role === "manager" ? parsed.departmentId! : null;

    await this.db
      .insert(organizationMembers)
      .values({
        organizationId,
        userId: targetUser.id,
        role: parsed.role,
        departmentId: deptId,
      })
      .onConflictDoUpdate({
        target: [organizationMembers.organizationId, organizationMembers.userId],
        set: {
          role: parsed.role,
          departmentId: deptId,
        },
      });

    return this.listMembers(requesterId, organizationId);
  }
}
