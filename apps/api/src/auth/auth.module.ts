import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ApiKeysModule } from "../api-keys/api-keys.module";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { McpAuthGuard } from "./mcp-auth.guard";
import { OrgAccessGuard } from "./org-access.guard";
import { ApiThrottlerGuard } from "../observability/api-throttler.guard";
import { OAuthResourceVerifierModule } from "./oauth-resource-verifier.module";

@Module({
  imports: [ApiKeysModule, OAuthResourceVerifierModule],
  providers: [
    AuthService,
    McpAuthGuard,
    // Global guards run in registration order: authenticate, authorize org membership, then rate-limit
    // per user (the limiter needs to know who is calling).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: OrgAccessGuard },
    { provide: APP_GUARD, useClass: ApiThrottlerGuard },
  ],
  exports: [AuthService, McpAuthGuard],
})
export class AuthModule {}
