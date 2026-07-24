import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ApiKeysModule } from "../api-keys/api-keys.module";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { McpAuthGuard } from "./mcp-auth.guard";
import { OAuthResourceVerifierModule } from "./oauth-resource-verifier.module";

@Module({
  imports: [ApiKeysModule, OAuthResourceVerifierModule],
  providers: [
    AuthService,
    McpAuthGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService, McpAuthGuard],
})
export class AuthModule {}
