import { Module } from "@nestjs/common";
import { ApiKeysModule } from "../api-keys/api-keys.module";
import { AuthModule } from "../auth/auth.module";
import { OAuthResourceVerifierModule } from "../auth/oauth-resource-verifier.module";
import { CommentsModule } from "../comments/comments.module";
import { DepartmentsModule } from "../departments/departments.module";
import { DiscordModule } from "../discord/discord.module";
import { ListsModule } from "../lists/lists.module";
import { RoadmapModule } from "../roadmap/roadmap.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { TasksModule } from "../tasks/tasks.module";
import { TimeModule } from "../time/time.module";
import { McpController } from "./mcp.controller";

@Module({
  imports: [
    AuthModule,
    ApiKeysModule,
    OAuthResourceVerifierModule,
    TasksModule,
    TimeModule,
    CommentsModule,
    OrganizationsModule,
    DepartmentsModule,
    DiscordModule,
    ListsModule,
    RoadmapModule,
  ],
  controllers: [McpController],
})
export class McpModule {}
