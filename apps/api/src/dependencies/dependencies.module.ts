import { Module } from "@nestjs/common";
import { AuthorizationModule } from "../authorization/authorization.module";
import { PushModule } from "../push/push.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { DependenciesController } from "./dependencies.controller";
import { DependenciesService } from "./dependencies.service";

@Module({
  imports: [AuthorizationModule, RealtimeModule, PushModule],
  controllers: [DependenciesController],
  providers: [DependenciesService],
})
export class DependenciesModule {}
