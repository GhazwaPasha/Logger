import { BadRequestException, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const TEXT_CHANNEL_TYPES = new Set([0, 5]);
const CATEGORY_TYPE = 4;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RATE_LIMIT_WAIT_MS = 2_000;
/** View Channel (0x400) + Send Messages (0x800) + Attach Files (0x8000). */
const INVITE_PERMISSIONS = 1024 + 2048 + 32768;
/** VIEW_CHANNEL permission bit; permission bitfields are 53+ bit strings, so compare as BigInt. */
const VIEW_CHANNEL_BIT = 1024n;

export class DiscordApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "DiscordApiError";
  }
}

export type DiscordChannel = { id: string; name: string; position: number; isPrivate: boolean };

type DiscordApiChannel = {
  id: string;
  name: string;
  type: number;
  position: number;
  parent_id?: string | null;
  permission_overwrites?: { id: string; type: number; allow: string; deny: string }[];
};

/** True if the `@everyone` role (id == guild id) has VIEW_CHANNEL explicitly denied on this channel/category. */
function everyoneDeniedView(channel: DiscordApiChannel, guildId: string): boolean {
  const overwrite = channel.permission_overwrites?.find((o) => o.type === 0 && o.id === guildId);
  if (!overwrite) return false;
  try {
    return (BigInt(overwrite.deny || "0") & VIEW_CHANNEL_BIT) !== 0n;
  } catch {
    return false;
  }
}

function describeStatus(status: number): string {
  switch (status) {
    case 401:
      return "Invalid bot token";
    case 403:
      return "Bot lacks permission in that channel (needs View Channel, Send Messages, Attach Files)";
    case 404:
      return "Server or channel not found (check the guild ID and that the bot is invited)";
    case 429:
      return "Rate limited by Discord";
    default:
      return `Discord API error (status ${status})`;
  }
}

/** Thin wrapper around Discord's bot REST API. One shared app-wide bot; workspaces just invite it and give a guild ID. */
@Injectable()
export class DiscordApiService implements OnModuleInit {
  private readonly log = new Logger(DiscordApiService.name);
  private botToken: string | null = null;
  private clientId: string | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const token = this.config.get<string>("DISCORD_BOT_TOKEN")?.trim();
    this.botToken = token || null;
    this.clientId = this.config.get<string>("DISCORD_CLIENT_ID")?.trim() || null;
    if (!this.botToken) this.log.warn("Discord disabled: set DISCORD_BOT_TOKEN");
  }

  isConfigured(): boolean {
    return this.botToken != null;
  }

  /** OAuth2 invite link for workspace owners to add the shared bot to their server; null if unconfigured. */
  getInviteUrl(): string | null {
    if (!this.clientId) return null;
    return `https://discord.com/oauth2/authorize?client_id=${this.clientId}&permissions=${INVITE_PERMISSIONS}&scope=bot`;
  }

  private requireToken(): string {
    if (!this.botToken) throw new BadRequestException("Discord is not configured on this server");
    return this.botToken;
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    return fetch(`${DISCORD_API_BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bot ${this.requireToken()}`, ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  }

  async testConnection(guildId: string): Promise<{ ok: true; guildName: string } | { ok: false; reason: string }> {
    try {
      const res = await this.request(`/guilds/${guildId}`);
      if (!res.ok) return { ok: false, reason: describeStatus(res.status) };
      const body = (await res.json()) as { name?: string };
      return { ok: true, guildName: body.name ?? guildId };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : "Connection failed" };
    }
  }

  async listGuildChannels(guildId: string): Promise<DiscordChannel[]> {
    const res = await this.request(`/guilds/${guildId}/channels`);
    if (!res.ok) throw new DiscordApiError(describeStatus(res.status), res.status);
    const body = (await res.json()) as DiscordApiChannel[];

    const categoriesById = new Map(body.filter((c) => c.type === CATEGORY_TYPE).map((c) => [c.id, c]));

    return body
      .filter((c) => TEXT_CHANNEL_TYPES.has(c.type))
      .sort((a, b) => a.position - b.position)
      .map((c) => {
        const parent = c.parent_id ? categoriesById.get(c.parent_id) : undefined;
        const isPrivate = everyoneDeniedView(c, guildId) || (parent ? everyoneDeniedView(parent, guildId) : false);
        return { id: c.id, name: c.name, position: c.position, isPrivate };
      });
  }

  async postFileMessage(
    channelId: string,
    opts: { content: string; fileBuffer: Buffer; fileName: string; mimeType: string },
  ): Promise<void> {
    const buildForm = () => {
      const form = new FormData();
      form.append("payload_json", JSON.stringify({ content: opts.content }));
      form.append("files[0]", new Blob([Uint8Array.from(opts.fileBuffer)], { type: opts.mimeType }), opts.fileName);
      return form;
    };

    let res = await this.request(`/channels/${channelId}/messages`, { method: "POST", body: buildForm() });

    if (res.status === 429) {
      const body = (await res.json().catch(() => null)) as { retry_after?: number } | null;
      const waitMs = Math.min(Math.max(body?.retry_after ?? 0, 0) * 1000, MAX_RATE_LIMIT_WAIT_MS);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      res = await this.request(`/channels/${channelId}/messages`, { method: "POST", body: buildForm() });
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      this.log.warn(`postFileMessage failed (${res.status}): ${detail.slice(0, 300)}`);
      throw new DiscordApiError(describeStatus(res.status), res.status);
    }
  }
}
