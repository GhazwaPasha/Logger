import { Module } from "@nestjs/common";
import { DepartmentsModule } from "../departments/departments.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { GoalController, GoalsController } from "./goals.controller";
import { GoalsService } from "./goals.service";
import { MilestoneController, MilestonesController } from "./milestones.controller";
import { MilestonesService } from "./milestones.service";
import { RoadmapController } from "./roadmap.controller";
import { RoadmapService } from "./roadmap.service";

@Module({
  imports: [RealtimeModule, DepartmentsModule],
  controllers: [RoadmapController, GoalsController, GoalController, MilestonesController, MilestoneController],
  providers: [RoadmapService, GoalsService, MilestonesService],
})
export class RoadmapModule {}
