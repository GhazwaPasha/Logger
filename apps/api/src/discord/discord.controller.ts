import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { DiscordApiService } from "./discord-api.service";
import { DiscordIntegrationService } from "./discord-integration.service";

@Controller("discord")
export class DiscordController {
  constructor(private readonly discordApi: DiscordApiService) {}

  /** OAuth2 link any workspace owner can use to invite the shared bot into their own Discord server. */
  @Get("invite-url")
  getInviteUrl() {
    const url = this.discordApi.getInviteUrl();
    if (!url) throw new BadRequestException("Discord is not configured on this server");
    return { url };
  }
}

@Controller("organizations/:organizationId/discord-integration")
export class DiscordIntegrationController {
  constructor(private readonly discordIntegration: DiscordIntegrationService) {}

  @Get()
  getConfig(@CurrentUser() user: RequestUser, @Param("organizationId") organizationId: string) {
    return this.discordIntegration.getConfig(user.id, organizationId);
  }

  @Put()
  saveConfig(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Body() body: unknown,
  ) {
    return this.discordIntegration.saveConfig(user.id, organizationId, body);
  }

  @Post("test")
  testConnection(@CurrentUser() user: RequestUser, @Param("organizationId") organizationId: string) {
    return this.discordIntegration.testConnection(user.id, organizationId);
  }

  @Delete()
  deleteConfig(@CurrentUser() user: RequestUser, @Param("organizationId") organizationId: string) {
    return this.discordIntegration.deleteConfig(user.id, organizationId);
  }
}

@Controller("organizations/:organizationId/discord-channels")
export class DiscordChannelsController {
  constructor(private readonly discordIntegration: DiscordIntegrationService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Param("organizationId") organizationId: string) {
    return this.discordIntegration.listChannelsForOrg(user.id, organizationId);
  }
}
