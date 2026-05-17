import { BadRequestException, Controller, Get, Param, Query } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { SearchService } from "./search.service";

@Controller("organizations/:organizationId/search")
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  query(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Query("q") q: string,
  ) {
    if (!q || q.trim().length < 2) throw new BadRequestException("Query must be at least 2 characters");
    if (q.length > 200) throw new BadRequestException("Query too long");
    return this.search.search(user.id, organizationId, q.trim());
  }
}
