import { Controller, Get, Param } from "@nestjs/common";
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
}
