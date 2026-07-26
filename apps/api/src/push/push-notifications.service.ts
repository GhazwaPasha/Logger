import { BadRequestException, Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { activityLedger, organizations, pushSubscriptions, user } from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { DRIZZLE } from "../db/drizzle.constants";
import { ledgerEntryUserIds, summarizeLedgerEntries, truncate } from "./ledger-copy";

type LedgerInsertRow = typeof activityLedger.$inferSelect;

@Injectable()
export class PushNotificationsService implements OnModuleInit {
  private readonly log = new Logger(PushNotificationsService.name);
  private vapidPublicKey: string | null = null;
  private vapidConfigured = false;

  constructor(
    private readonly config: ConfigService,
    @Inject(DRIZZLE) private readonly db: AppDatabase,
  ) {}

  onModuleInit() {
    const pub = this.config.get<string>("WEB_PUSH_VAPID_PUBLIC_KEY")?.trim();
    const priv = this.config.get<string>("WEB_PUSH_VAPID_PRIVATE_KEY")?.trim();
    const subject = this.config.get<string>("WEB_PUSH_CONTACT")?.trim() ?? "mailto:support@example.com";

    if (!pub || !priv) {
      this.log.warn("Web Push disabled: set WEB_PUSH_VAPID_PUBLIC_KEY and WEB_PUSH_VAPID_PRIVATE_KEY");
      return;
    }

    try {
      webpush.setVapidDetails(subject, pub, priv);
      this.vapidPublicKey = pub;
      this.vapidConfigured = true;
    } catch (e) {
      this.log.warn(`Web Push init failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  getVapidPublicKey(): string | null {
    return this.vapidPublicKey;
  }

  isConfigured(): boolean {
    return this.vapidConfigured;
  }

  async saveSubscription(userId: string, body: unknown) {
    if (!this.vapidConfigured) {
      throw new BadRequestException("Push is not configured on this server");
    }
    const parsed = body as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    const endpoint = typeof parsed.endpoint === "string" ? parsed.endpoint.trim() : "";
    const p256dh = typeof parsed.keys?.p256dh === "string" ? parsed.keys.p256dh.trim() : "";
    const auth = typeof parsed.keys?.auth === "string" ? parsed.keys.auth.trim() : "";
    if (!endpoint || !p256dh || !auth) {
      throw new BadRequestException("Invalid subscription payload");
    }

    await this.db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));

    await this.db.insert(pushSubscriptions).values({
      userId,
      endpoint,
      p256dh,
      auth,
    });

    return { ok: true as const };
  }

  async deleteSubscription(userId: string, endpointRaw: string | undefined) {
    const endpoint = typeof endpointRaw === "string" ? endpointRaw.trim() : "";
    if (!endpoint) throw new BadRequestException("endpoint required");

    await this.db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));

    return { ok: true as const };
  }

  async notifyLedgerActivity(opts: {
    organizationId: string;
    actorUserId: string;
    taskId: string;
    taskTitle: string;
    assignerUserId: string;
    assigneeUserIds: string[];
    ledgerDelta: LedgerInsertRow[];
  }) {
    if (!this.vapidConfigured || opts.ledgerDelta.length === 0) return;

    const recipients = [...new Set([opts.assignerUserId, ...opts.assigneeUserIds])].filter(
      (id) => id !== opts.actorUserId,
    );
    if (recipients.length === 0) return;

    const subs = await this.db
      .select()
      .from(pushSubscriptions)
      .where(inArray(pushSubscriptions.userId, recipients));

    if (subs.length === 0) return;

    const [orgRow] = await this.db
      .select({ slug: organizations.slug })
      .from(organizations)
      .where(eq(organizations.id, opts.organizationId))
      .limit(1);

    const slug = orgRow?.slug ?? opts.organizationId;
    // Path-only so notificationclick opens on the subscriber's origin (prod, preview, custom domain).
    const url = `/${slug}/work?task=${encodeURIComponent(opts.taskId)}`;

    const nameIds = new Set<string>([opts.actorUserId]);
    for (const row of opts.ledgerDelta) for (const id of ledgerEntryUserIds(row)) nameIds.add(id);
    const nameRows = await this.db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(inArray(user.id, [...nameIds]));
    const names = new Map(nameRows.map((r) => [r.id, r.name]));

    const summary = summarizeLedgerEntries(opts.ledgerDelta, names);
    const title = names.get(opts.actorUserId) ?? "Someone";
    const body = `${truncate(opts.taskTitle, 80)} · ${summary}`;
    const payload = JSON.stringify({ title, body, url });

    await Promise.all(
      subs.map(async (row) => {
        const subscription = {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        };
        try {
          await webpush.sendNotification(subscription, payload, {
            TTL: 3600,
            urgency: "normal",
          });
        } catch (e: unknown) {
          const status = typeof e === "object" && e !== null && "statusCode" in e ? (e as { statusCode?: number }).statusCode : undefined;
          if (status === 404 || status === 410) {
            await this.db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, row.endpoint));
          } else {
            this.log.debug(`Push send failed: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }),
    );
  }
}
