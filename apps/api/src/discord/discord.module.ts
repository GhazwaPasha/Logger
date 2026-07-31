import { Module } from "@nestjs/common";
import { DiscordApiService } from "./discord-api.service";
import { DiscordIntegrationService } from "./discord-integration.service";
import { DiscordNotifyService } from "./discord-notify.service";
import { DiscordChannelsController, DiscordController, DiscordIntegrationController } from "./discord.controller";

@Module({
  controllers: [DiscordController, DiscordIntegrationController, DiscordChannelsController],
  providers: [DiscordApiService, DiscordIntegrationService, DiscordNotifyService],
  exports: [DiscordNotifyService, DiscordIntegrationService],
})
export class DiscordModule {}
