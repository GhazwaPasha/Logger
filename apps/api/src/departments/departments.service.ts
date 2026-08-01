import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq, inArray, max } from "drizzle-orm";
import { createDepartmentSchema, reorderDepartmentsSchema, updateDepartmentSchema } from "@work-ledger/contracts";
import { deletionLog, departments, lists, tasks } from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { DRIZZLE } from "../db/drizzle.constants";
import { AttachmentsService } from "../attachments/attachments.service";
import { AuthorizationService } from "../authorization/authorization.service";
import { CollaborationService } from "../realtime/collaboration.service";

@Injectable()
export class DepartmentsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: AppDatabase,
    private readonly authz: AuthorizationService,
    private readonly collaboration: CollaborationService,
    private readonly attachments: AttachmentsService,
  ) {}

  async list(userId: string, organizationId: string) {
    await this.authz.assertOrgMember(userId, organizationId);
    return this.db
      .select()
      .from(departments)
      .where(eq(departments.organizationId, organizationId))
      .orderBy(asc(departments.orderIndex), asc(departments.createdAt));
  }

  async create(userId: string, organizationId: string, body: unknown) {
    const m = await this.authz.assertOrgMember(userId, organizationId);
    if (m.role !== "owner") {
      throw new ForbiddenException("Only owners can create departments");
    }
    const parsed = createDepartmentSchema.parse(body);
    const [{ maxOrder }] = await this.db
      .select({ maxOrder: max(departments.orderIndex) })
      .from(departments)
      .where(eq(departments.organizationId, organizationId));
    const [dept] = await this.db
      .insert(departments)
      .values({ organizationId, name: parsed.name, orderIndex: (maxOrder ?? -1) + 1 })
      .returning();
    this.collaboration.notifyOrgChanged(organizationId, null);
    return dept;
  }

  /** Owner only. `orderedIds` must be exactly the organization's existing department ids, in the new order. */
  async reorder(userId: string, organizationId: string, body: unknown) {
    const m = await this.authz.assertOrgMember(userId, organizationId);
    if (m.role !== "owner") {
      throw new ForbiddenException("Only owners can reorder levels");
    }
    const parsed = reorderDepartmentsSchema.parse(body);
    const existing = await this.db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.organizationId, organizationId));
    const existingIds = new Set(existing.map((d) => d.id));
    const orderedIds = parsed.orderedIds;
    if (
      orderedIds.length !== existingIds.size ||
      new Set(orderedIds).size !== orderedIds.length ||
      !orderedIds.every((id) => existingIds.has(id))
    ) {
      throw new BadRequestException("orderedIds must match the organization's existing departments exactly");
    }
    await this.db.transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx
          .update(departments)
          .set({ orderIndex: i })
          .where(and(eq(departments.id, orderedIds[i]!), eq(departments.organizationId, organizationId)));
      }
    });
    this.collaboration.notifyOrgChanged(organizationId, null);
    return this.list(userId, organizationId);
  }

  async patch(userId: string, organizationId: string, departmentId: string, body: unknown) {
    const m = await this.authz.assertOrgMember(userId, organizationId);
    if (m.role !== "owner") {
      throw new ForbiddenException("Only owners can rename levels");
    }
    await this.assertDeptInOrg(organizationId, departmentId);
    const parsed = updateDepartmentSchema.parse(body);
    const [dept] = await this.db
      .update(departments)
      .set({ name: parsed.name })
      .where(and(eq(departments.id, departmentId), eq(departments.organizationId, organizationId)))
      .returning();
    this.collaboration.notifyOrgChanged(organizationId, null);
    return dept!;
  }

  /** Owner only. Cascades to lists and tasks (FK). */
  async remove(userId: string, organizationId: string, departmentId: string) {
    const m = await this.authz.assertOrgMember(userId, organizationId);
    if (m.role !== "owner") {
      throw new ForbiddenException("Only owners can delete levels");
    }
    const rows = await this.db
      .select()
      .from(departments)
      .where(and(eq(departments.id, departmentId), eq(departments.organizationId, organizationId)))
      .limit(1);
    const department = rows[0];
    if (!department) throw new NotFoundException("Level not found");

    const deptLists = await this.db.select({ id: lists.id }).from(lists).where(eq(lists.departmentId, departmentId));
    const cascadedTasks =
      deptLists.length === 0
        ? []
        : await this.db
            .select({ id: tasks.id })
            .from(tasks)
            .where(inArray(tasks.listId, deptLists.map((l) => l.id)));
    await this.attachments.releaseForTaskIds(cascadedTasks.map((t) => t.id));

    await this.db.insert(deletionLog).values({
      entityType: "department",
      entityId: departmentId,
      organizationId,
      actorId: userId,
      snapshot: {
        name: department.name,
        cascadedListCount: deptLists.length,
        cascadedTaskCount: cascadedTasks.length,
        cascadedTaskIds: cascadedTasks.map((t) => t.id),
      },
    });

    this.collaboration.notifyOrgChanged(organizationId, null);
    await this.db
      .delete(departments)
      .where(and(eq(departments.id, departmentId), eq(departments.organizationId, organizationId)));
  }

  async assertDeptInOrg(organizationId: string, departmentId: string) {
    const rows = await this.db
      .select()
      .from(departments)
      .where(and(eq(departments.id, departmentId), eq(departments.organizationId, organizationId)))
      .limit(1);
    if (rows.length === 0) {
      throw new ForbiddenException("Department not in organization");
    }
    return rows[0]!;
  }
}
