import { Body, Controller, Delete, Param, Patch, Post } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { MilestonesService } from "./milestones.service";

@Controller("organizations/:organizationId/milestones")
export class MilestonesController {
  constructor(private readonly milestones: MilestonesService) {}

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Body() body: unknown,
  ) {
    return this.milestones.create(user.id, organizationId, body);
  }
}

@Controller("organizations/:organizationId/milestones/:milestoneId")
export class MilestoneController {
  constructor(private readonly milestones: MilestonesService) {}

  @Patch()
  update(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Param("milestoneId") milestoneId: string,
    @Body() body: unknown,
  ) {
    return this.milestones.update(user.id, organizationId, milestoneId, body);
  }

  @Delete()
  remove(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Param("milestoneId") milestoneId: string,
  ) {
    return this.milestones.remove(user.id, organizationId, milestoneId);
  }

  @Post("tasks")
  linkTasks(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Param("milestoneId") milestoneId: string,
    @Body() body: unknown,
  ) {
    return this.milestones.linkTasks(user.id, organizationId, milestoneId, body);
  }

  @Delete("tasks/:taskId")
  unlinkTask(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Param("milestoneId") milestoneId: string,
    @Param("taskId") taskId: string,
  ) {
    return this.milestones.unlinkTask(user.id, organizationId, milestoneId, taskId);
  }
}
