import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { createDepartmentSchema, updateDepartmentSchema } from "@work-ledger/contracts";
import { departments } from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { DRIZZLE } from "../db/drizzle.constants";
import { AuthorizationService } from "../authorization/authorization.service";

@Injectable()
export class DepartmentsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: AppDatabase,
    private readonly authz: AuthorizationService,
  ) {}

  async list(userId: string, organizationId: string) {
    await this.authz.assertOrgMember(userId, organizationId);
    return this.db
      .select()
      .from(departments)
      .where(eq(departments.organizationId, organizationId));
  }

  async create(userId: string, organizationId: string, body: unknown) {
    const m = await this.authz.assertOrgMember(userId, organizationId);
    if (m.role !== "owner") {
      throw new ForbiddenException("Only owners can create departments");
    }
    const parsed = createDepartmentSchema.parse(body);
    const [dept] = await this.db
      .insert(departments)
      .values({ organizationId, name: parsed.name })
      .returning();
    return dept;
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
    return dept!;
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
