import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { RoadmapService } from "./roadmap.service";

@Controller("organizations/:organizationId/roadmap")
export class RoadmapController {
  constructor(private readonly roadmap: RoadmapService) {}

  @Get()
  getTree(@CurrentUser() user: RequestUser, @Param("organizationId") organizationId: string) {
    return this.roadmap.getTree(user.id, organizationId);
  }

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Body() body: unknown,
  ) {
    return this.roadmap.create(user.id, organizationId, body);
  }
}

@Controller("organizations/:organizationId/roadmap/:itemId")
export class RoadmapItemController {
  constructor(private readonly roadmap: RoadmapService) {}

  @Patch()
  update(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Param("itemId") itemId: string,
    @Body() body: unknown,
  ) {
    return this.roadmap.update(user.id, organizationId, itemId, body);
  }

  @Delete()
  remove(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Param("itemId") itemId: string,
  ) {
    return this.roadmap.remove(user.id, organizationId, itemId);
  }

  @Post("generate-children")
  generateChildren(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Param("itemId") itemId: string,
    @Body() body: unknown,
  ) {
    return this.roadmap.generateChildren(user.id, organizationId, itemId, body);
  }

  @Post("tasks")
  linkTasks(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Param("itemId") itemId: string,
    @Body() body: unknown,
  ) {
    return this.roadmap.linkTasks(user.id, organizationId, itemId, body);
  }

  @Delete("tasks/:taskId")
  unlinkTask(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Param("itemId") itemId: string,
    @Param("taskId") taskId: string,
  ) {
    return this.roadmap.unlinkTask(user.id, organizationId, itemId, taskId);
  }
}
