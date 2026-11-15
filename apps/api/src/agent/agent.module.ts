import { Module } from "@nestjs/common";
import { CommentsModule } from "../comments/comments.module";
import { DepartmentsModule } from "../departments/departments.module";
import { ListsModule } from "../lists/lists.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PerformanceModule } from "../performance/performance.module";
import { RoadmapModule } from "../roadmap/roadmap.module";
import { SearchModule } from "../search/search.module";
import { TasksModule } from "../tasks/tasks.module";
import { AgentController } from "./agent.controller";
import { AgentService } from "./agent.service";
import { GeminiClient } from "./gemini.client";
import { TrackersModule } from "../trackers/trackers.module";

/** "Ask LogBase": the in-app agent. Read-only tools for now — see agent-tools.ts. */
@Module({
  imports: [
    TasksModule,
    SearchModule,
    OrganizationsModule,
    DepartmentsModule,
    ListsModule,
    CommentsModule,
    RoadmapModule,
    PerformanceModule,
    TrackersModule,
  ],
  controllers: [AgentController],
  providers: [AgentService, GeminiClient],
})
export class AgentModule {}
