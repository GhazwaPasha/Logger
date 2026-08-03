import { Controller, Get, Param, Query } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { PerformanceService } from "./performance.service";

@Controller("organizations/:organizationId/performance")
export class PerformanceController {
  constructor(private readonly performance: PerformanceService) {}

  @Get("scorecards")
  scorecards(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
  ) {
    return this.performance.scorecards(user.id, organizationId, { dateFrom, dateTo });
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
