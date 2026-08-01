import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq, inArray, max } from "drizzle-orm";
import { createListSchema, reorderListsSchema, updateListSchema } from "@work-ledger/contracts";
import { deletionLog, lists, tasks } from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { AttachmentsService } from "../attachments/attachments.service";
import { AuthorizationService } from "../authorization/authorization.service";
import { DRIZZLE } from "../db/drizzle.constants";
import { DepartmentsService } from "../departments/departments.service";
import { CollaborationService } from "../realtime/collaboration.service";

@Injectable()
export class ListsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: AppDatabase,
    private readonly authz: AuthorizationService,
    private readonly departments: DepartmentsService,
    private readonly collaboration: CollaborationService,
    private readonly attachments: AttachmentsService,
  ) {}

  async list(userId: string, organizationId: string) {
    await this.authz.assertOrgMember(userId, organizationId);
    return this.db
      .select()
      .from(lists)
      .where(eq(lists.organizationId, organizationId))
      .orderBy(asc(lists.orderIndex), asc(lists.createdAt));
  }

  async create(userId: string, organizationId: string, body: unknown) {
    const member = await this.authz.assertOrgMember(userId, organizationId);
    if (member.role !== "owner") {
      throw new ForbiddenException("Only owners can create lists");
    }
    const parsed = createListSchema.parse(body);
    await this.departments.assertDeptInOrg(organizationId, parsed.departmentId);
    const [{ maxOrder }] = await this.db
      .select({ maxOrder: max(lists.orderIndex) })
      .from(lists)
      .where(eq(lists.departmentId, parsed.departmentId));
    const [row] = await this.db
      .insert(lists)
      .values({
        organizationId,
        departmentId: parsed.departmentId,
        name: parsed.name,
        orderIndex: (maxOrder ?? -1) + 1,
      })
      .returning();
    this.collaboration.notifyOrgChanged(organizationId, null);
    return row!;
  }

  /** Owner only. `orderedIds` must be exactly the given department's existing list ids, in the new order. */
  async reorder(userId: string, organizationId: string, body: unknown) {
    const member = await this.authz.assertOrgMember(userId, organizationId);
    if (member.role !== "owner") {
      throw new ForbiddenException("Only owners can reorder lists");
    }
    const parsed = reorderListsSchema.parse(body);
    await this.departments.assertDeptInOrg(organizationId, parsed.departmentId);
    const existing = await this.db
      .select({ id: lists.id })
      .from(lists)
      .where(and(eq(lists.organizationId, organizationId), eq(lists.departmentId, parsed.departmentId)));
    const existingIds = new Set(existing.map((l) => l.id));
    const orderedIds = parsed.orderedIds;
    if (
      orderedIds.length !== existingIds.size ||
      new Set(orderedIds).size !== orderedIds.length ||
      !orderedIds.every((id) => existingIds.has(id))
    ) {
      throw new BadRequestException("orderedIds must match the department's existing lists exactly");
    }
    await this.db.transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx
          .update(lists)
          .set({ orderIndex: i, updatedAt: new Date() })
          .where(
            and(
              eq(lists.id, orderedIds[i]!),
              eq(lists.organizationId, organizationId),
              eq(lists.departmentId, parsed.departmentId),
            ),
          );
      }
    });
    this.collaboration.notifyOrgChanged(organizationId, null);
    return this.list(userId, organizationId);
  }

  async patch(userId: string, organizationId: string, listId: string, body: unknown) {
    const member = await this.authz.assertOrgMember(userId, organizationId);
    if (member.role !== "owner") {
      throw new ForbiddenException("Only owners can rename lists");
    }
    await this.assertListInOrg(organizationId, listId);
    const parsed = updateListSchema.parse(body);
    const [row] = await this.db
      .update(lists)
      .set({ name: parsed.name, updatedAt: new Date() })
      .where(and(eq(lists.id, listId), eq(lists.organizationId, organizationId)))
      .returning();
    this.collaboration.notifyOrgChanged(organizationId, null);
    return row!;
  }

  /** Owner only. Cascades to tasks (FK). */
  async remove(userId: string, organizationId: string, listId: string) {
    const member = await this.authz.assertOrgMember(userId, organizationId);
    if (member.role !== "owner") {
      throw new ForbiddenException("Only owners can delete lists");
    }
    const rows = await this.db
      .select()
      .from(lists)
      .where(and(eq(lists.id, listId), eq(lists.organizationId, organizationId)))
      .limit(1);
    const list = rows[0];
    if (!list) throw new NotFoundException("List not found");

    const cascadedTasks = await this.db
      .select({ id: tasks.id, title: tasks.title })
      .from(tasks)
      .where(eq(tasks.listId, listId));
    await this.attachments.releaseForTaskIds(cascadedTasks.map((t) => t.id));

    await this.db.insert(deletionLog).values({
      entityType: "list",
      entityId: listId,
      organizationId,
      actorId: userId,
      snapshot: {
        name: list.name,
        cascadedTaskCount: cascadedTasks.length,
        cascadedTaskIds: cascadedTasks.map((t) => t.id),
      },
    });

    this.collaboration.notifyOrgChanged(organizationId, null);
    await this.db.delete(lists).where(and(eq(lists.id, listId), eq(lists.organizationId, organizationId)));
  }

  async assertListInOrg(organizationId: string, listId: string) {
    const rows = await this.db
      .select()
      .from(lists)
      .where(and(eq(lists.id, listId), eq(lists.organizationId, organizationId)))
      .limit(1);
    if (rows.length === 0) {
      throw new ForbiddenException("List not in organization");
    }
    return rows[0]!;
  }
}

