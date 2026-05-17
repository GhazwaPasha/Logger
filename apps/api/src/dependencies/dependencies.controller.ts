import { Body, Controller, Delete, Get, HttpCode, Param, Post } from "@nestjs/common";
import { z } from "zod";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { DependenciesService } from "./dependencies.service";

const addDependencySchema = z.object({
  dependsOnTaskId: z.string().uuid(),
});

@Controller()
export class DependenciesController {
  constructor(private readonly deps: DependenciesService) {}

  @Get("tasks/:taskId/dependencies/blockers")
  listBlockers(@CurrentUser() user: RequestUser, @Param("taskId") taskId: string) {
    return this.deps.listBlockers(user.id, taskId);
  }

  @Get("tasks/:taskId/dependencies/blocking")
  listBlocking(@CurrentUser() user: RequestUser, @Param("taskId") taskId: string) {
    return this.deps.listBlocking(user.id, taskId);
  }

  @Post("tasks/:taskId/dependencies")
  add(
    @CurrentUser() user: RequestUser,
    @Param("taskId") taskId: string,
    @Body() body: unknown,
  ) {
    const { dependsOnTaskId } = addDependencySchema.parse(body);
    return this.deps.add(user.id, taskId, dependsOnTaskId);
  }

  @Delete("tasks/:taskId/dependencies/:dependsOnTaskId")
  @HttpCode(204)
  remove(
    @CurrentUser() user: RequestUser,
    @Param("taskId") taskId: string,
    @Param("dependsOnTaskId") dependsOnTaskId: string,
  ) {
    return this.deps.remove(user.id, taskId, dependsOnTaskId);
  }
}
