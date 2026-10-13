import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { OrgVersionedInterceptor } from "../cache/org-versioned";
import { AuthModule } from "../auth/auth.module";
import { CollaborationService } from "./collaboration.service";
import { OrgCollaborationGateway } from "./org-collaboration.gateway";

@Module({
  imports: [AuthModule],
  providers: [
    CollaborationService,
    OrgCollaborationGateway,
    { provide: APP_INTERCEPTOR, useClass: OrgVersionedInterceptor },
  ],
  exports: [CollaborationService],
})
export class RealtimeModule {}
