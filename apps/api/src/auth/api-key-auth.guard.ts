import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { ApiKeysService } from "../api-keys/api-keys.service";
import type { RequestUser } from "./jwt-auth.guard";

/** Guards machine/agent routes (e.g. the MCP endpoint) with a long-lived API key instead of a browser JWT. */
@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(private readonly apiKeys: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing Bearer API key");
    }
    const rawKey = header.slice("Bearer ".length).trim();
    const result = await this.apiKeys.verify(rawKey);
    if (!result) {
      throw new UnauthorizedException("Invalid or revoked API key");
    }
    (req as Request & { user: RequestUser }).user = { id: result.userId };
    return true;
  }
}
