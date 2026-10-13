import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { OrgVersioned } from "../cache/org-versioned";
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

  /** Departments, lists and members — identical for every member, so one cached copy per org. */
  @Get(":organizationId/workspace")
  @OrgVersioned({ namespace: "workspace", shared: true })
  workspace(@CurrentUser() user: RequestUser, @Param("organizationId") organizationId: string) {
    return this.orgs.workspaceBootstrap(user.id, organizationId);
  }

  @Get(":organizationId/activity")
  @OrgVersioned({ namespace: "activity" })
  activityFeed(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Query("limit") limitRaw?: string,
    @Query("cursor") cursor?: string,
    @Query("actorId") actorId?: string,
  ) {
    const n = limitRaw !== undefined ? Number(limitRaw) : undefined;
    return this.orgs.activityFeed(user.id, organizationId, {
      limit: n !== undefined && Number.isFinite(n) ? n : undefined,
      cursor,
      actorId: actorId || undefined,
    });
  }

  @Get(":organizationId/deletion-log")
  deletionLog(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Query("limit") limitRaw?: string,
  ) {
    const n = limitRaw !== undefined ? Number(limitRaw) : undefined;
    return this.orgs.deletionLogFeed(user.id, organizationId, {
      limit: n !== undefined && Number.isFinite(n) ? n : undefined,
    });
  }

  @Get(":organizationId")
  getOne(@CurrentUser() user: RequestUser, @Param("organizationId") organizationId: string) {
    return this.orgs.getById(user.id, organizationId);
  }

  @Delete(":organizationId")
  remove(@CurrentUser() user: RequestUser, @Param("organizationId") organizationId: string) {
    return this.orgs.remove(user.id, organizationId);
  }
}
