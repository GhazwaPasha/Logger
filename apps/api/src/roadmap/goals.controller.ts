import { Body, Controller, Delete, Param, Patch, Post } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { GoalsService } from "./goals.service";

@Controller("organizations/:organizationId/goals")
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Body() body: unknown,
  ) {
    return this.goals.create(user.id, organizationId, body);
  }
}

@Controller("organizations/:organizationId/goals/:goalId")
export class GoalController {
  constructor(private readonly goals: GoalsService) {}

  @Patch()
  update(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Param("goalId") goalId: string,
    @Body() body: unknown,
  ) {
    return this.goals.update(user.id, organizationId, goalId, body);
  }

  @Delete()
  remove(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Param("goalId") goalId: string,
  ) {
    return this.goals.remove(user.id, organizationId, goalId);
  }
}
