import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { createListSchema, updateListSchema } from "@work-ledger/contracts";
import { lists } from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { AuthorizationService } from "../authorization/authorization.service";
import { DRIZZLE } from "../db/drizzle.constants";
import { DepartmentsService } from "../departments/departments.service";

@Injectable()
export class ListsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: AppDatabase,
    private readonly authz: AuthorizationService,
    private readonly departments: DepartmentsService,
  ) {}

  async list(userId: string, organizationId: string) {
    await this.authz.assertOrgMember(userId, organizationId);
    return this.db.select().from(lists).where(eq(lists.organizationId, organizationId));
  }

  async create(userId: string, organizationId: string, body: unknown) {
    const member = await this.authz.assertOrgMember(userId, organizationId);
    if (member.role !== "owner") {
      throw new ForbiddenException("Only owners can create lists");
    }
    const parsed = createListSchema.parse(body);
    await this.departments.assertDeptInOrg(organizationId, parsed.departmentId);
    const [row] = await this.db
      .insert(lists)
      .values({
        organizationId,
        departmentId: parsed.departmentId,
        name: parsed.name,
      })
      .returning();
    return row!;
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
    return row!;
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

