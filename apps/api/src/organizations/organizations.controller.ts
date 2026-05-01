import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { OrganizationsService } from "./organizations.service";

@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.orgs.listForUser(user.id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.orgs.create(user.id, body);
  }

  @Patch(":organizationId")
  patch(@CurrentUser() user: RequestUser, @Param("organizationId") organizationId: string, @Body() body: unknown) {
    return this.orgs.patch(user.id, organizationId, body);
  }

  @Get(":organizationId/workspace")
  workspace(@CurrentUser() user: RequestUser, @Param("organizationId") organizationId: string) {
    return this.orgs.workspaceBootstrap(user.id, organizationId);
  }

  @Get(":organizationId")
  getOne(@CurrentUser() user: RequestUser, @Param("organizationId") organizationId: string) {
    return this.orgs.getById(user.id, organizationId);
  }
}
