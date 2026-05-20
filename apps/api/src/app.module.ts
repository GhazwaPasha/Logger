import { join } from "path";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
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
import { NotificationsModule } from "./notifications/notifications.module";
import { ReportsModule } from "./reports/reports.module";
import { SearchModule } from "./search/search.module";
import { DependenciesModule } from "./dependencies/dependencies.module";
import { TimeModule } from "./time/time.module";
import { RealtimeModule } from "./realtime/realtime.module";

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
    OrganizationsModule,
    DepartmentsModule,
    ListsModule,
    TasksModule,
    AttachmentsModule,
    CommentsModule,
    NotificationsModule,
    SearchModule,
    ReportsModule,
    DependenciesModule,
    TimeModule,
    RealtimeModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
