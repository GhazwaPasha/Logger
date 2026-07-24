import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

interface McpSessionRow {
  userId?: string;
  accessTokenExpiresAt?: string;
}

/** Verifies OAuth access tokens issued by apps/web's Better Auth `mcp` plugin, for the separate apps/api process. */
@Injectable()
export class OAuthResourceVerifierService {
  constructor(private readonly config: ConfigService) {}

  async verify(accessToken: string): Promise<{ userId: string } | null> {
    const base = (
      this.config.get<string>("AUTH_ISSUER") ?? this.config.get<string>("NEXT_PUBLIC_APP_URL") ?? ""
    ).replace(/\/$/, "");
    if (!base) return null;

    let res: Response;
    try {
      res = await fetch(`${base}/api/auth/mcp/get-session`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch {
      return null;
    }
    if (!res.ok) return null;

    const row = (await res.json().catch(() => null)) as McpSessionRow | null;
    if (!row?.userId || !row.accessTokenExpiresAt) return null;

    // get-session does NOT check expiry itself — we must, or an expired token would be trusted forever.
    const expiresAt = new Date(row.accessTokenExpiresAt).getTime();
    if (Number.isNaN(expiresAt) || expiresAt <= Date.now()) return null;

    return { userId: row.userId };
  }
}
