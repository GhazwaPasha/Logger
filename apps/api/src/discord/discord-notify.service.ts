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
  /** Task's due date at submission time; null if the task has none set. */
  dueAt: Date | null;
  /** When the submission was received (not when Discord delivery completes). */
  submittedAt: Date;
  source: DiscordAttachmentSource;
};

export type DiscordDeliveryResult = { ok: true } | { ok: false; reason: string };

function formatDueDate(d: Date): string {
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** `null` when the task has no due date — timing isn't meaningful without one. */
function timingLabel(dueAt: Date | null, submittedAt: Date): string | null {
  if (!dueAt) return null;
  return submittedAt.getTime() > dueAt.getTime()
    ? `⏰ late — was due ${formatDueDate(dueAt)}`
    : `✅ on time — due ${formatDueDate(dueAt)}`;
}

/** Posts a task attachment into the workspace's configured Discord channel; caller awaits the outcome. */
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

  async notifyAttachment(opts: NotifyAttachmentOpts): Promise<DiscordDeliveryResult> {
    if (!this.discordApi.isConfigured()) {
      return { ok: false, reason: "Discord is not configured on this server" };
    }

    const [integration] = await this.db
      .select()
      .from(discordIntegrations)
      .where(eq(discordIntegrations.organizationId, opts.organizationId))
      .limit(1);
    if (!integration) {
      return { ok: false, reason: "This workspace hasn't connected a Discord server" };
    }

    const fileBuffer = await this.resolveBytes(opts.source);
    if (!fileBuffer) {
      return { ok: false, reason: "Could not read the file to send to Discord" };
    }
    if (fileBuffer.length > DISCORD_MAX_UPLOAD_BYTES) {
      return { ok: false, reason: "File exceeds Discord's upload limit" };
    }

    const [uploaderRow, orgRow] = await Promise.all([
      this.db.select({ name: user.name }).from(user).where(eq(user.id, opts.uploaderId)).limit(1),
      this.db.select({ slug: organizations.slug }).from(organizations).where(eq(organizations.id, opts.organizationId)).limit(1),
    ]);
    const uploaderName = uploaderRow[0]?.name ?? "Someone";
    const slug = orgRow[0]?.slug;
    const baseUrl = this.config.get<string>("WEB_APP_BASE_URL")?.trim().replace(/\/$/, "");
    const taskUrl = baseUrl && slug ? `\n${baseUrl}/${slug}/work?task=${encodeURIComponent(opts.taskId)}` : "";

    const timing = timingLabel(opts.dueAt, opts.submittedAt);
    const timingSuffix = timing ? ` · ${timing}` : "";
    const content = `📎 Discord submission on **${opts.taskTitle}** · submitted by ${uploaderName}${timingSuffix}${taskUrl}`;

    try {
      await this.discordApi.postFileMessage(opts.discordChannelId, {
        content,
        fileBuffer,
        fileName: opts.fileName,
        mimeType: opts.mimeType,
      });
      return { ok: true };
    } catch (e) {
      const reason = e instanceof Error ? e.message : "Discord rejected the message";
      this.log.warn(`Discord delivery failed for task ${opts.taskId}: ${reason}`);
      return { ok: false, reason };
    }
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
