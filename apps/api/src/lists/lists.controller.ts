import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { ListsService } from "./lists.service";

@Controller("organizations/:organizationId/lists")
export class ListsController {
  constructor(private readonly lists: ListsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Param("organizationId") organizationId: string) {
    return this.lists.list(user.id, organizationId);
  }

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Body() body: unknown,
  ) {
    return this.lists.create(user.id, organizationId, body);
  }

  @Patch(":listId")
  patch(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Param("listId") listId: string,
    @Body() body: unknown,
  ) {
    return this.lists.patch(user.id, organizationId, listId, body);
  }
}

