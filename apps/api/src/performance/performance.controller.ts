import { Controller, Get, Headers, Param, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { MemoryCacheService } from "../cache/memory-cache.service";
import { PerformanceService } from "./performance.service";

/** Results differ by requester's role (manager sees a scoped roster) — always key by requester, never shared. */
const SCORECARDS_TTL_SECONDS = 20;

@Controller("organizations/:organizationId/performance")
export class PerformanceController {
  constructor(
    private readonly performance: PerformanceService,
    private readonly cache: MemoryCacheService,
  ) {}

  @Get("scorecards")
  async scorecards(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Headers("if-none-match") ifNoneMatch?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const key = `perf:scorecards:${organizationId}:${user.id}:${dateFrom ?? ""}:${dateTo ?? ""}`;
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
    const data = await this.performance.scorecards(user.id, organizationId, { dateFrom, dateTo });
    const etag = this.cache.set(key, data, SCORECARDS_TTL_SECONDS);
    res!.setHeader("ETag", etag);
    res!.setHeader("Cache-Control", "private, no-cache");
    return data;
  }

  @Get("scorecards/:userId/tasks")
  memberTasks(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Param("userId") userId: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
  ) {
    return this.performance.memberTasks(user.id, organizationId, userId, { dateFrom, dateTo });
  }
}
