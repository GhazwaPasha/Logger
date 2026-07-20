import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { eq } from "drizzle-orm";
import { discordIntegrations, organizations, user } from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { DRIZZLE } from "../db/drizzle.constants";
import { buildR2Client, getObjectBuffer } from "../attachments/attachments-storage.util";
import { DiscordApiService } from "./discord-api.service";

/** Discord's non-boosted-server upload ceiling; defense-in-depth (the app's own attachment cap is already 10MB). */
const DISCORD_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type DiscordAttachmentSource = { fileBuffer: Buffer } | { storageKey: string };

export type NotifyAttachmentOpts = {
  organizationId: string;
  taskId: string;
  taskTitle: string;
  discordChannelId: string;
  uploaderId: string;
  fileName: string;
  mimeType: string;
  source: DiscordAttachmentSource;
};

/** Fire-and-forget side effect: posts a newly attached task file into the workspace's configured Discord channel. */
@Injectable()
export class DiscordNotifyService {
  private readonly log = new Logger(DiscordNotifyService.name);
  private readonly s3 = buildR2Client();
  private readonly bucket = process.env.R2_BUCKET_NAME ?? "";

  constructor(
    @Inject(DRIZZLE) private readonly db: AppDatabase,
    private readonly config: ConfigService,
    private readonly discordApi: DiscordApiService,
  ) {}

  async notifyAttachment(opts: NotifyAttachmentOpts): Promise<void> {
    if (!this.discordApi.isConfigured()) return;

    const [integration] = await this.db
      .select()
      .from(discordIntegrations)
      .where(eq(discordIntegrations.organizationId, opts.organizationId))
      .limit(1);
    if (!integration) return;

    const fileBuffer = await this.resolveBytes(opts.source);
    if (!fileBuffer) return;
    if (fileBuffer.length > DISCORD_MAX_UPLOAD_BYTES) {
      this.log.warn(`Skipping Discord post for task ${opts.taskId}: file exceeds Discord's upload limit`);
      return;
    }

    const [uploaderRow, orgRow] = await Promise.all([
      this.db.select({ name: user.name }).from(user).where(eq(user.id, opts.uploaderId)).limit(1),
      this.db.select({ slug: organizations.slug }).from(organizations).where(eq(organizations.id, opts.organizationId)).limit(1),
    ]);
    const uploaderName = uploaderRow[0]?.name ?? "Someone";
    const slug = orgRow[0]?.slug;
    const baseUrl = this.config.get<string>("WEB_APP_BASE_URL")?.trim().replace(/\/$/, "");
    const taskUrl = baseUrl && slug ? `\n${baseUrl}/${slug}/work?task=${encodeURIComponent(opts.taskId)}` : "";

    const content = `📎 New attachment on **${opts.taskTitle}** · uploaded by ${uploaderName}${taskUrl}`;

    await this.discordApi.postFileMessage(opts.discordChannelId, {
      content,
      fileBuffer,
      fileName: opts.fileName,
      mimeType: opts.mimeType,
    });
  }

  private async resolveBytes(source: DiscordAttachmentSource): Promise<Buffer | null> {
    if ("fileBuffer" in source) return source.fileBuffer;
    if (!this.s3 || !this.bucket) return null;
    try {
      return await getObjectBuffer(this.s3, this.bucket, source.storageKey);
    } catch (e) {
      this.log.warn(`Failed to fetch attachment bytes for Discord post: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  }
}
