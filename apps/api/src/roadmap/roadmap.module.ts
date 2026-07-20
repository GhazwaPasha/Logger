import { Module } from "@nestjs/common";
import { DepartmentsModule } from "../departments/departments.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { RoadmapController, RoadmapItemController } from "./roadmap.controller";
import { RoadmapService } from "./roadmap.service";

@Module({
  imports: [RealtimeModule, DepartmentsModule],
  controllers: [RoadmapController, RoadmapItemController],
  providers: [RoadmapService],
})
export class RoadmapModule {}
