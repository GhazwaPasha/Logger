import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CollaborationService } from "./collaboration.service";
import { OrgCollaborationGateway } from "./org-collaboration.gateway";

@Module({
  imports: [AuthModule],
  providers: [CollaborationService, OrgCollaborationGateway],
  exports: [CollaborationService],
})
export class RealtimeModule {}
