import { join } from "path";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { AuthorizationModule } from "./authorization/authorization.module";
import { DbModule } from "./db/db.module";
import { DepartmentsModule } from "./departments/departments.module";
import { ListsModule } from "./lists/lists.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { TasksModule } from "./tasks/tasks.module";
import { HealthController } from "./health.controller";

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
    DbModule,
    AuthorizationModule,
    AuthModule,
    OrganizationsModule,
    DepartmentsModule,
    ListsModule,
    TasksModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
