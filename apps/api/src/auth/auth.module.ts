import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ApiKeysModule } from "../api-keys/api-keys.module";
import { ApiKeyAuthGuard } from "./api-key-auth.guard";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Module({
  imports: [ApiKeysModule],
  providers: [
    AuthService,
    ApiKeyAuthGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService, ApiKeyAuthGuard],
})
export class AuthModule {}
