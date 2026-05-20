import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { AttachmentsService } from "./attachments.service";

@Injectable()
export class AttachmentsOrphanCleanupService {
  private readonly logger = new Logger(AttachmentsOrphanCleanupService.name);

  constructor(private readonly attachments: AttachmentsService) {}

  /** Daily: delete R2 objects under `attachments/` with no blob row, older than 24h. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOrphans(): Promise<void> {
    const disabled =
      process.env.ATTACHMENT_ORPHAN_CLEANUP === "0" || process.env.ATTACHMENT_ORPHAN_CLEANUP === "false";
    if (disabled) return;

    try {
      const result = await this.attachments.runOrphanCleanup();
      if (!result) return;
      if (result.deleted > 0) {
        this.logger.log(`Removed ${result.deleted} orphan object(s) (scanned ${result.scanned})`);
      }
    } catch (err) {
      this.logger.error("Orphan attachment cleanup failed", err instanceof Error ? err.stack : String(err));
    }
  }
}
