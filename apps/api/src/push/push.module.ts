import { Module } from "@nestjs/common";
import { PushController } from "./push.controller";
import { PushNotificationsService } from "./push-notifications.service";

@Module({
  controllers: [PushController],
  providers: [PushNotificationsService],
  exports: [PushNotificationsService],
})
export class PushModule {}
