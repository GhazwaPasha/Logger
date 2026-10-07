import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { discordIntegrationConfigSchema } from "@work-ledger/contracts";
import { deletionLog, discordIntegrations } from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { DRIZZLE } from "../db/drizzle.constants";
import { AuthorizationService } from "../authorization/authorization.service";
import { DiscordApiService, type DiscordChannel } from "./discord-api.service";

@Injectable()
export class DiscordIntegrationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: AppDatabase,
    private readonly authz: AuthorizationService,
    private readonly discordApi: DiscordApiService,
  ) {}

  private async getRow(organizationId: string) {
    const [row] = await this.db
      .select()
      .from(discordIntegrations)
      .where(eq(discordIntegrations.organizationId, organizationId))
      .limit(1);
    return row ?? null;
  }

  async getConfig(userId: string, organizationId: string) {
    await this.authz.assertOrgOwner(userId, organizationId);
    const row = await this.getRow(organizationId);
    if (!row) return null;
    return { guildId: row.guildId, updatedAt: row.updatedAt };
  }

  async saveConfig(userId: string, organizationId: string, body: unknown) {
    await this.authz.assertOrgOwner(userId, organizationId);
    const parsed = discordIntegrationConfigSchema.parse(body);

    await this.db
      .insert(discordIntegrations)
      .values({ organizationId, guildId: parsed.guildId })
      .onConflictDoUpdate({
        target: discordIntegrations.organizationId,
        // Clear the old server's icon; the test below fills in the new one if the bot can see the guild.
        set: { guildId: parsed.guildId, iconHash: null },
      });

    return this.testAndStoreIcon(organizationId, parsed.guildId);
  }

  async testConnection(userId: string, organizationId: string) {
    await this.authz.assertOrgOwner(userId, organizationId);
    const row = await this.getRow(organizationId);
    if (!row) return { ok: false as const, reason: "Discord is not connected for this workspace" };
    return this.testAndStoreIcon(organizationId, row.guildId);
  }

  /** Each successful check refreshes the stored icon hash (the org avatar), so a changed server icon heals itself. */
  private async testAndStoreIcon(organizationId: string, guildId: string) {
    const result = await this.discordApi.testConnection(guildId);
    if (result.ok) {
      await this.db
        .update(discordIntegrations)
        .set({ iconHash: result.iconHash })
        .where(eq(discordIntegrations.organizationId, organizationId));
    }
    return result;
  }

  async deleteConfig(userId: string, organizationId: string) {
    await this.authz.assertOrgOwner(userId, organizationId);
    const existing = await this.getRow(organizationId);
    if (existing) {
      await this.db.insert(deletionLog).values({
        entityType: "discord_integration",
        entityId: existing.id,
        organizationId,
        actorId: userId,
        snapshot: { guildId: existing.guildId },
      });
    }
    await this.db.delete(discordIntegrations).where(eq(discordIntegrations.organizationId, organizationId));
    return { ok: true as const };
  }

  /** Any org member — the task channel picker needs this, not just the owner. */
  async listChannelsForOrg(userId: string, organizationId: string): Promise<DiscordChannel[]> {
    await this.authz.assertOrgMember(userId, organizationId);
    const row = await this.getRow(organizationId);
    if (!row) return [];
    try {
      return await this.discordApi.listGuildChannels(row.guildId);
    } catch {
      return [];
    }
  }
}
