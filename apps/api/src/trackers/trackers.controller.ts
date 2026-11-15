import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { TrackersService } from "./trackers.service";

@Controller("organizations/:organizationId/trackers")
export class TrackersController {
  constructor(private readonly trackers: TrackersService) {}

  /** `?scope=mine` for the caller's own trackers (the mobile Trackers screen); `?archived=1` includes archived ones. */
  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Query("scope") scope?: string,
    @Query("archived") archived?: string,
  ) {
    return this.trackers.list(user.id, organizationId, { scope, archived: archived === "1" || archived === "true" });
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Param("organizationId") organizationId: string, @Body() body: unknown) {
    return this.trackers.create(user.id, organizationId, body);
  }

  @Get(":trackerId")
  get(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Param("trackerId") trackerId: string,
  ) {
    return this.trackers.get(user.id, organizationId, trackerId);
  }

  @Patch(":trackerId")
  update(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Param("trackerId") trackerId: string,
    @Body() body: unknown,
  ) {
    return this.trackers.update(user.id, organizationId, trackerId, body);
  }

  @Delete(":trackerId")
  remove(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Param("trackerId") trackerId: string,
  ) {
    return this.trackers.remove(user.id, organizationId, trackerId);
  }

  /** Log or correct progress for the slot containing `date` (`YYYY-MM-DD`). */
  @Put(":trackerId/entries/:date")
  upsertEntry(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Param("trackerId") trackerId: string,
    @Param("date") date: string,
    @Body() body: unknown,
  ) {
    return this.trackers.upsertEntry(user.id, organizationId, trackerId, date, body);
  }

  @Delete(":trackerId/entries/:date")
  deleteEntry(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Param("trackerId") trackerId: string,
    @Param("date") date: string,
  ) {
    return this.trackers.deleteEntry(user.id, organizationId, trackerId, date);
  }
}
