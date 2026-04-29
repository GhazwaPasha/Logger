import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { OrganizationsService } from "./organizations.service";

@Controller("organizations/:organizationId/members")
export class OrganizationMembersController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Param("organizationId") organizationId: string) {
    return this.orgs.listMembers(user.id, organizationId);
  }

  @Post()
  upsert(@CurrentUser() user: RequestUser, @Param("organizationId") organizationId: string, @Body() body: unknown) {
    return this.orgs.upsertMemberByEmail(user.id, organizationId, body);
  }
}
