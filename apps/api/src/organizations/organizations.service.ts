import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq, inArray } from "drizzle-orm";
import { createOrganizationSchema } from "@work-ledger/contracts";
import { organizationMembers, organizations } from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { DRIZZLE } from "../db/drizzle.constants";
import { AuthorizationService } from "../authorization/authorization.service";

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: AppDatabase,
    private readonly authz: AuthorizationService,
  ) {}

  async listForUser(userId: string) {
    const ids = await this.authz.listOrganizationIdsForUser(userId);
    if (ids.length === 0) return [];
    return this.db.select().from(organizations).where(inArray(organizations.id, ids));
  }

  async create(userId: string, body: unknown) {
    const parsed = createOrganizationSchema.parse(body);
    const [org] = await this.db.insert(organizations).values({ name: parsed.name }).returning();
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
}
