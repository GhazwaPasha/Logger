import { Controller, Get, Param } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { OrgVersioned } from "../cache/org-versioned";
import { RoadmapService } from "./roadmap.service";

@Controller("organizations/:organizationId/roadmap")
export class RoadmapController {
  constructor(private readonly roadmap: RoadmapService) {}

  /** Same result for every org member (no role gate) — one cached copy per org. */
  @Get()
  @OrgVersioned({ namespace: "roadmap", shared: true })
  getTree(@CurrentUser() user: RequestUser, @Param("organizationId") organizationId: string) {
    return this.roadmap.getTree(user.id, organizationId);
  }
}
