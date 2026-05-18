import { join } from "path";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
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
import { WebhooksModule } from "./webhooks/webhooks.module";
import { RealtimeModule } from "./realtime/realtime.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Compiled to apps/api/dist → three levels up is monorepo root
      envFilePath: [
        join(__dirname, "..", "..", "..", ".env"),
        join(__dirname, "..", "..", "..", ".env.local"),
      ],
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const redisUrl = config.get<string>("REDIS_URL");
        if (!redisUrl) {
          const { default: IORedis } = await import("ioredis");
          return { connection: new IORedis({ lazyConnect: true, enableOfflineQueue: false }) };
        }
        const url = new URL(redisUrl);
        return {
          connection: {
            host: url.hostname,
            port: url.port ? parseInt(url.port, 10) : 6379,
            password: url.password || undefined,
            tls: url.protocol === "rediss:" ? {} : undefined,
          },
        };
      },
    }),
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
    WebhooksModule,
    RealtimeModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
