import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue, Worker } from "bullmq";
import { createHmac, randomBytes } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { webhookDeliveries, webhookEndpoints, organizationMembers } from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { DRIZZLE } from "../db/drizzle.constants";

const ALLOWED_EVENTS = [
  "task.created",
  "task.status_changed",
  "task.ledger_added",
  "member.added",
] as const;

export type WebhookEvent = (typeof ALLOWED_EVENTS)[number];

interface DeliveryJobData {
  endpointId: string;
  url: string;
  secret: string;
  event: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class WebhooksService implements OnModuleInit {
  private readonly log = new Logger(WebhooksService.name);
  private worker: Worker | null = null;

  constructor(
    @Inject(DRIZZLE) private readonly db: AppDatabase,
    @InjectQueue("webhook-delivery") private readonly queue: Queue,
  ) {}

  onModuleInit() {
    const connection = this.queue.opts.connection as { host?: string } | undefined;
    if (!connection) return;

    this.worker = new Worker<DeliveryJobData>(
      "webhook-delivery",
      async (job) => {
        const { endpointId, url, secret, event, payload } = job.data;
        const body = JSON.stringify(payload);
        const sig = createHmac("sha256", secret).update(body).digest("hex");

        let responseStatus: string | null = null;
        let responseBody: string | null = null;
        let deliveredAt: Date | null = null;
        let failedAt: Date | null = null;

        try {
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-LogBase-Signature": `sha256=${sig}`,
              "X-LogBase-Event": event,
            },
            body,
            signal: AbortSignal.timeout(10_000),
          });
          responseStatus = String(res.status);
          responseBody = (await res.text()).slice(0, 2000);
          if (res.ok) deliveredAt = new Date();
          else failedAt = new Date();
        } catch (err) {
          responseStatus = null;
          responseBody = String(err);
          failedAt = new Date();
        }

        await this.db.insert(webhookDeliveries).values({
          webhookEndpointId: endpointId,
          event,
          payload,
          responseStatus,
          responseBody,
          deliveredAt,
          failedAt,
        });

        if (failedAt && !deliveredAt) throw new Error(`Delivery failed: ${responseStatus ?? "timeout"}`);
      },
      { connection },
    );

    this.worker.on("failed", (job, err) => {
      this.log.warn(`Webhook job ${job?.id} failed: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  async deliver(orgId: string, event: WebhookEvent, payload: Record<string, unknown>) {
    const endpoints = await this.db
      .select()
      .from(webhookEndpoints)
      .where(and(eq(webhookEndpoints.organizationId, orgId), eq(webhookEndpoints.isActive, true)));

    const fullPayload = { event, organizationId: orgId, at: new Date().toISOString(), data: payload };

    for (const ep of endpoints) {
      if (!ep.events.includes(event)) continue;
      await this.queue.add(
        "deliver",
        {
          endpointId: ep.id,
          url: ep.url,
          secret: ep.secret,
          event,
          payload: fullPayload,
        } satisfies DeliveryJobData,
        { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
      );
    }
  }

  async create(userId: string, orgId: string, body: { url: string; events: string[]; secret?: string }) {
    await this.assertOwner(userId, orgId);

    const validEvents = body.events.filter((e): e is WebhookEvent =>
      (ALLOWED_EVENTS as readonly string[]).includes(e),
    );
    if (validEvents.length === 0) throw new Error("At least one valid event required");

    const secret = body.secret ?? randomBytes(24).toString("hex");

    const [ep] = await this.db
      .insert(webhookEndpoints)
      .values({ organizationId: orgId, url: body.url, secret, events: validEvents })
      .returning();

    return { ...ep, secret };
  }

  async list(userId: string, orgId: string) {
    await this.assertOwner(userId, orgId);
    return this.db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.organizationId, orgId))
      .orderBy(desc(webhookEndpoints.createdAt));
  }

  async remove(userId: string, orgId: string, endpointId: string) {
    await this.assertOwner(userId, orgId);
    const [ep] = await this.db
      .select()
      .from(webhookEndpoints)
      .where(and(eq(webhookEndpoints.id, endpointId), eq(webhookEndpoints.organizationId, orgId)))
      .limit(1);
    if (!ep) throw new NotFoundException("Webhook endpoint not found");
    await this.db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, endpointId));
  }

  async test(userId: string, orgId: string, endpointId: string) {
    await this.assertOwner(userId, orgId);
    const [ep] = await this.db
      .select()
      .from(webhookEndpoints)
      .where(and(eq(webhookEndpoints.id, endpointId), eq(webhookEndpoints.organizationId, orgId)))
      .limit(1);
    if (!ep) throw new NotFoundException("Webhook endpoint not found");

    const payload = { event: "test", organizationId: orgId, at: new Date().toISOString(), data: { test: true } };
    const body = JSON.stringify(payload);
    const sig = createHmac("sha256", ep.secret).update(body).digest("hex");

    try {
      const res = await fetch(ep.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-LogBase-Signature": `sha256=${sig}`,
          "X-LogBase-Event": "test",
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      return { status: res.status, body: (await res.text()).slice(0, 500) };
    } catch (err) {
      return { status: null, body: String(err) };
    }
  }

  async listDeliveries(userId: string, orgId: string, endpointId: string) {
    await this.assertOwner(userId, orgId);
    const [ep] = await this.db
      .select({ id: webhookEndpoints.id })
      .from(webhookEndpoints)
      .where(and(eq(webhookEndpoints.id, endpointId), eq(webhookEndpoints.organizationId, orgId)))
      .limit(1);
    if (!ep) throw new NotFoundException("Webhook endpoint not found");

    return this.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookEndpointId, endpointId))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(20);
  }

  private async assertOwner(userId: string, orgId: string) {
    const [member] = await this.db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, userId)))
      .limit(1);
    if (!member || member.role !== "owner") throw new ForbiddenException("Only org owners can manage webhooks");
  }

  static get allowedEvents() {
    return ALLOWED_EVENTS;
  }
}
