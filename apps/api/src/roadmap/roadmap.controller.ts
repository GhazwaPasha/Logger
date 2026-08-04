import { Controller, Get, Headers, Param, Res } from "@nestjs/common";
import type { Response } from "express";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { MemoryCacheService } from "../cache/memory-cache.service";
import { RoadmapService } from "./roadmap.service";

/** Same result for every org member (no role gate) — safe to key by org only. */
const ROADMAP_TTL_SECONDS = 30;

@Controller("organizations/:organizationId/roadmap")
export class RoadmapController {
  constructor(
    private readonly roadmap: RoadmapService,
    private readonly cache: MemoryCacheService,
  ) {}

  @Get()
  async getTree(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Headers("if-none-match") ifNoneMatch?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const key = `roadmap:${organizationId}`;
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
    const data = await this.roadmap.getTree(user.id, organizationId);
    const etag = this.cache.set(key, data, ROADMAP_TTL_SECONDS);
    res!.setHeader("ETag", etag);
    res!.setHeader("Cache-Control", "private, no-cache");
    return data;
  }
}
