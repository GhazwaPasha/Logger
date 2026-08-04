import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { MemoryCacheService } from "../cache/memory-cache.service";
import { OrganizationsService } from "./organizations.service";

/** Same result for every org member (no role gate) — safe to key by org only. */
const WORKSPACE_BOOTSTRAP_TTL_SECONDS = 30;

@Controller("organizations")
export class OrganizationsController {
  constructor(
    private readonly orgs: OrganizationsService,
    private readonly cache: MemoryCacheService,
  ) {}

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
  async workspace(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Headers("if-none-match") ifNoneMatch?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const key = `workspace:${organizationId}`;
    const cached = this.cache.get(key);
    if (cached && cached.etag === ifNoneMatch) {
      res!.status(304).end();
      return;
    }
    if (cached) {
      res!.setHeader("ETag", cached.etag);
      res!.setHeader("Cache-Control", "private, no-cache");
      return cached.data;
    }
    const data = await this.orgs.workspaceBootstrap(user.id, organizationId);
    const etag = this.cache.set(key, data, WORKSPACE_BOOTSTRAP_TTL_SECONDS);
    res!.setHeader("ETag", etag);
    res!.setHeader("Cache-Control", "private, no-cache");
    return data;
  }

  @Get(":organizationId/activity")
  activityFeed(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Query("limit") limitRaw?: string,
  ) {
    const n = limitRaw !== undefined ? Number(limitRaw) : undefined;
    return this.orgs.activityFeed(user.id, organizationId, {
      limit: n !== undefined && Number.isFinite(n) ? n : undefined,
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
