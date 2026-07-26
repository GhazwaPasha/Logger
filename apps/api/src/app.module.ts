import { join } from "path";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { ApiKeysModule } from "./api-keys/api-keys.module";
import { AuthModule } from "./auth/auth.module";
import { AuthorizationModule } from "./authorization/authorization.module";
import { DbModule } from "./db/db.module";
import { DepartmentsModule } from "./departments/departments.module";
import { ListsModule } from "./lists/lists.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { TasksModule } from "./tasks/tasks.module";
import { HealthController } from "./health.controller";
import { AttachmentsModule } from "./attachments/attachments.module";
import { CommentsModule } from "./comments/comments.module";
import { ReportsModule } from "./reports/reports.module";
import { SearchModule } from "./search/search.module";
import { DependenciesModule } from "./dependencies/dependencies.module";
import { TimeModule } from "./time/time.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { RoadmapModule } from "./roadmap/roadmap.module";
import { DiscordModule } from "./discord/discord.module";
import { McpModule } from "./mcp/mcp.module";
import { WellKnownModule } from "./well-known/well-known.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(__dirname, "..", "..", "..", ".env"),
        join(__dirname, "..", "..", "..", ".env.local"),
      ],
    }),
    ScheduleModule.forRoot(),
    DbModule,
    AuthorizationModule,
    AuthModule,
    ApiKeysModule,
    OrganizationsModule,
    DepartmentsModule,
    ListsModule,
    TasksModule,
    AttachmentsModule,
    CommentsModule,
    SearchModule,
    ReportsModule,
    DependenciesModule,
    TimeModule,
    RealtimeModule,
    RoadmapModule,
    DiscordModule,
    McpModule,
    WellKnownModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
