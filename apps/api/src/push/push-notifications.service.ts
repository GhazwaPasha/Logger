import { BadRequestException, Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, eq, inArray } from "drizzle-orm";
import { cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";
import webpush from "web-push";
import { notificationRecipients } from "@work-ledger/contracts";
import { activityLedger, mobilePushTokens, organizations, pushSubscriptions, user } from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { DRIZZLE } from "../db/drizzle.constants";
import { ledgerEntryUserIds, summarizeLedgerEntries, truncate } from "./ledger-copy";

type LedgerInsertRow = typeof activityLedger.$inferSelect;

@Injectable()
export class PushNotificationsService implements OnModuleInit {
  private readonly log = new Logger(PushNotificationsService.name);
  private vapidPublicKey: string | null = null;
  private vapidConfigured = false;
  private fcm: Messaging | null = null;

  constructor(
    private readonly config: ConfigService,
    @Inject(DRIZZLE) private readonly db: AppDatabase,
  ) {}

  onModuleInit() {
    this.initWebPush();
    this.initFcm();
  }

  /** Mobile push goes straight to Firebase Cloud Messaging with the project's service account. */
  private initFcm() {
    try {
      const account = parseServiceAccount(this.config.get<string>("FIREBASE_SERVICE_ACCOUNT"));
      if (!account) {
        this.log.warn("Mobile push disabled: set FIREBASE_SERVICE_ACCOUNT (the Firebase service-account JSON)");
        return;
      }
      const app = getApps().find((a) => a.name === "push") ?? initializeApp({ credential: cert(account) }, "push");
      this.fcm = getMessaging(app);
    } catch (e) {
      this.log.warn(`Mobile push init failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private initWebPush() {
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
    if ((!this.vapidConfigured && !this.fcm) || opts.ledgerDelta.length === 0) return;

    // Same rule as the in-app bells: each person only hears about the entries that matter to them.
    const audience = { assigneeUserIds: opts.assigneeUserIds, assignerId: opts.assignerUserId };
    const candidates = [opts.assignerUserId, ...opts.assigneeUserIds];
    for (const row of opts.ledgerDelta) candidates.push(...ledgerEntryUserIds(row));
    const rowsFor = new Map<string, LedgerInsertRow[]>();
    for (const row of opts.ledgerDelta) {
      for (const id of notificationRecipients(row, candidates, audience)) {
        rowsFor.set(id, [...(rowsFor.get(id) ?? []), row]);
      }
    }
    const recipients = [...rowsFor.keys()];
    if (recipients.length === 0) return;

    const [subs, devices] = await Promise.all([
      this.vapidConfigured
        ? this.db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, recipients))
        : Promise.resolve([]),
      this.fcm
        ? this.db.select().from(mobilePushTokens).where(inArray(mobilePushTokens.userId, recipients))
        : Promise.resolve([]),
    ]);
    if (subs.length === 0 && devices.length === 0) return;

    const [orgRow] = await this.db
      .select({ slug: organizations.slug, timeZone: organizations.timeZone })
      .from(organizations)
      .where(eq(organizations.id, opts.organizationId))
      .limit(1);

    const slug = orgRow?.slug ?? opts.organizationId;
    const timeZone = orgRow?.timeZone ?? "UTC";
    // Path-only so notificationclick opens on the subscriber's origin (prod, preview, custom domain).
    const url = `/${slug}/work?task=${encodeURIComponent(opts.taskId)}`;

    const nameIds = new Set<string>([opts.actorUserId]);
    for (const row of opts.ledgerDelta) for (const id of ledgerEntryUserIds(row)) nameIds.add(id);
    const nameRows = await this.db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(inArray(user.id, [...nameIds]));
    const names = new Map(nameRows.map((r) => [r.id, r.name]));

    const title = names.get(opts.actorUserId) ?? "Someone";
    const bodyFor = (userId: string) =>
      `${truncate(opts.taskTitle, 80)} · ${summarizeLedgerEntries(rowsFor.get(userId) ?? [], names, timeZone)}`;

    await Promise.all([
      this.sendToDevices(devices, (userId) => ({
        title,
        body: bodyFor(userId),
        data: { taskId: opts.taskId, organizationId: opts.organizationId },
      })),
      ...subs.map(async (row) => {
        const payload = JSON.stringify({ title, body: bodyFor(row.userId), url });
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
    ]);
  }

  // -------------------------------------------------------------------------------------------
  // Mobile app push (Firebase Cloud Messaging)
  // -------------------------------------------------------------------------------------------

  /** Save (or move to this user) a device's FCM token. A reinstall or account switch reuses the row. */
  async saveDeviceToken(userId: string, body: unknown) {
    const parsed = body as { token?: unknown; platform?: unknown };
    const token = typeof parsed?.token === "string" ? parsed.token.trim() : "";
    const platform = parsed?.platform === "ios" ? "ios" : parsed?.platform === "android" ? "android" : "";
    if (!token || token.length > 4096 || !platform) throw new BadRequestException("token and platform required");

    await this.db
      .insert(mobilePushTokens)
      .values({ userId, token, platform })
      .onConflictDoUpdate({
        target: mobilePushTokens.token,
        set: { userId, platform, updatedAt: new Date() },
      });
    return { ok: true as const, delivery: this.fcm !== null };
  }

  async deleteDeviceToken(userId: string, tokenRaw: unknown) {
    const token = typeof tokenRaw === "string" ? tokenRaw.trim() : "";
    if (!token) throw new BadRequestException("token required");
    await this.db
      .delete(mobilePushTokens)
      .where(and(eq(mobilePushTokens.userId, userId), eq(mobilePushTokens.token, token)));
    return { ok: true as const };
  }

  private async sendToDevices(
    devices: (typeof mobilePushTokens.$inferSelect)[],
    messageFor: (userId: string) => { title: string; body: string; data: Record<string, string> },
  ) {
    const fcm = this.fcm;
    if (!fcm || devices.length === 0) return;

    const byUser = new Map<string, string[]>();
    for (const d of devices) byUser.set(d.userId, [...(byUser.get(d.userId) ?? []), d.token]);

    const dead: string[] = [];
    await Promise.all(
      [...byUser].map(async ([userId, tokens]) => {
        const { title, body, data } = messageFor(userId);
        try {
          const res = await fcm.sendEachForMulticast({
            tokens,
            notification: { title, body },
            data,
            android: {
              priority: "high",
              // One notification per task: a newer update replaces the older one instead of stacking.
              notification: { channelId: "activity", tag: data.taskId },
            },
            apns: { payload: { aps: { threadId: data.taskId, sound: "default" } } },
          });
          res.responses.forEach((r, i) => {
            const code = r.error?.code;
            if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
              dead.push(tokens[i]!);
            } else if (r.error) {
              this.log.debug(`FCM send failed: ${r.error.message}`);
            }
          });
        } catch (e) {
          this.log.debug(`FCM send failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }),
    );
    if (dead.length > 0) await this.db.delete(mobilePushTokens).where(inArray(mobilePushTokens.token, dead));
  }
}

/**
 * The Firebase service account, from FIREBASE_SERVICE_ACCOUNT: the key file's JSON, raw or base64-encoded
 * (base64 survives dashboards that mangle newlines in the private key).
 */
function parseServiceAccount(raw: string | undefined): ServiceAccount | null {
  const text = raw?.trim();
  if (!text) return null;
  const json = text.startsWith("{") ? text : Buffer.from(text, "base64").toString("utf8");
  const parsed = JSON.parse(json) as { project_id?: string; client_email?: string; private_key?: string };
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is missing project_id / client_email / private_key");
  }
  return { projectId: parsed.project_id, clientEmail: parsed.client_email, privateKey: parsed.private_key };
}
