import { Controller, Get, Param, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { ReportsService } from "./reports.service";

@Controller("organizations/:organizationId/reports")
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("tasks.csv")
  async tasksCsv(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("status") status?: string,
    @Res() res?: Response,
  ) {
    const csv = await this.reports.exportTasksCsv(user.id, organizationId, { dateFrom, dateTo, status });
    res!.setHeader("Content-Type", "text/csv");
    res!.setHeader("Content-Disposition", 'attachment; filename="tasks.csv"');
    res!.send(csv);
  }

  @Get("activity.csv")
  async activityCsv(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Res() res?: Response,
  ) {
    const csv = await this.reports.exportActivityCsv(user.id, organizationId, { dateFrom, dateTo });
    res!.setHeader("Content-Type", "text/csv");
    res!.setHeader("Content-Disposition", 'attachment; filename="activity.csv"');
    res!.send(csv);
  }
}
