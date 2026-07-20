import { Module } from "@nestjs/common";
import { DiscordModule } from "../discord/discord.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { AttachmentsController } from "./attachments.controller";
import { AttachmentsOrphanCleanupService } from "./attachments-orphan-cleanup.service";
import { AttachmentsService } from "./attachments.service";

@Module({
  imports: [RealtimeModule, DiscordModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService, AttachmentsOrphanCleanupService],
})
export class AttachmentsModule {}
