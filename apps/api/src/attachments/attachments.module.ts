import { Module } from "@nestjs/common";
import { DiscordModule } from "../discord/discord.module";
import { PushModule } from "../push/push.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { AttachmentsController } from "./attachments.controller";
import { AttachmentsOrphanCleanupService } from "./attachments-orphan-cleanup.service";
import { AttachmentsService } from "./attachments.service";

@Module({
  imports: [RealtimeModule, DiscordModule, PushModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService, AttachmentsOrphanCleanupService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
