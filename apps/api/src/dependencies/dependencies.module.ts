import { Module } from "@nestjs/common";
import { AuthorizationModule } from "../authorization/authorization.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { DependenciesController } from "./dependencies.controller";
import { DependenciesService } from "./dependencies.service";

@Module({
  imports: [AuthorizationModule, RealtimeModule],
  controllers: [DependenciesController],
  providers: [DependenciesService],
})
export class DependenciesModule {}
