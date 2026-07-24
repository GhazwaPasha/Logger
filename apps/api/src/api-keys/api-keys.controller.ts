import { Body, Controller, Delete, Get, HttpCode, Param, Post } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { ApiKeysService } from "./api-keys.service";

@Controller("api-keys")
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.apiKeys.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.apiKeys.create(user.id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  revoke(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.apiKeys.revoke(user.id, id);
  }
}
