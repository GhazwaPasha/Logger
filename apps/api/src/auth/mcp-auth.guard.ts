import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { ApiKeysService } from "../api-keys/api-keys.service";
import type { RequestUser } from "./jwt-auth.guard";
import { OAuthResourceVerifierService } from "./oauth-resource-verifier.service";

/**
 * Guards the MCP endpoint with either of two credential types:
 * - a static, long-lived API key (unchanged fast path — local DB hash lookup, used by Claude Code);
 * - an OAuth access token issued by apps/web's Better Auth `mcp` plugin (new — used by Claude
 *   Desktop/claude.ai's Custom Connectors, verified via a remote call since apps/api and apps/web
 *   are separate processes).
 * The API key check runs first and short-circuits, so existing static-key clients are unaffected.
 */
@Injectable()
export class McpAuthGuard implements CanActivate {
  constructor(
    private readonly apiKeys: ApiKeysService,
    private readonly oauthVerifier: OAuthResourceVerifierService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      this.setWwwAuthenticate(res);
      throw new UnauthorizedException("Missing Bearer token");
    }
    const raw = header.slice("Bearer ".length).trim();

    const apiKeyResult = await this.apiKeys.verify(raw);
    if (apiKeyResult) {
      (req as Request & { user: RequestUser }).user = { id: apiKeyResult.userId };
      return true;
    }

    const oauthResult = await this.oauthVerifier.verify(raw);
    if (oauthResult) {
      (req as Request & { user: RequestUser }).user = { id: oauthResult.userId };
      return true;
    }

    this.setWwwAuthenticate(res);
    throw new UnauthorizedException("Invalid or expired credentials");
  }

  /** Tells an OAuth-aware MCP client where to discover this resource server's authorization server. */
  private setWwwAuthenticate(res: Response) {
    const origin = (this.config.get<string>("NEXT_PUBLIC_API_URL") ?? "").replace(/\/$/, "");
    res.setHeader("WWW-Authenticate", `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`);
    res.setHeader("Access-Control-Expose-Headers", "WWW-Authenticate");
  }
}
