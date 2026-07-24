import { Controller, Get, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import { Public } from "../auth/public.decorator";

@Controller()
export class WellKnownController {
  constructor(private readonly config: ConfigService) {}

  /**
   * MCP/OAuth resource-server discovery doc. apps/api (the resource server, where /mcp lives)
   * and apps/web (the OAuth authorization server, via Better Auth's `mcp` plugin) are separate
   * origins, so each must publish its own half of the discovery contract — this is apps/api's half.
   * Public discovery doc, so CORS is deliberately open (not restricted to the app's own origin
   * allowlist) — any MCP client fetching this from a browser context needs it readable.
   */
  @Public()
  @Get(".well-known/oauth-protected-resource")
  protectedResource(@Res({ passthrough: true }) res: Response) {
    res.header("Access-Control-Allow-Origin", "*");
    const resourceOrigin = (this.config.get<string>("NEXT_PUBLIC_API_URL") ?? "").replace(/\/$/, "");
    const authServerOrigin = (
      this.config.get<string>("AUTH_ISSUER") ?? this.config.get<string>("NEXT_PUBLIC_APP_URL") ?? ""
    ).replace(/\/$/, "");
    return {
      resource: `${resourceOrigin}/mcp`,
      authorization_servers: [authServerOrigin],
      bearer_methods_supported: ["header"],
      scopes_supported: ["openid", "profile", "email", "offline_access"],
    };
  }
}
