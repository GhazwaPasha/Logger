import { Module } from "@nestjs/common";
import { PushModule } from "../push/push.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { TrackerRemindersService } from "./tracker-reminders.service";
import { TrackersController } from "./trackers.controller";
import { TrackersService } from "./trackers.service";

@Module({
  imports: [RealtimeModule, PushModule],
  controllers: [TrackersController],
  providers: [TrackersService, TrackerRemindersService],
  exports: [TrackersService],
})
export class TrackersModule {}
