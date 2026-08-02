import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { count, eq, inArray } from "drizzle-orm";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { activityLedger, attachmentBlobs, taskAssignees, taskAttachments, tasks } from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { DRIZZLE } from "../db/drizzle.constants";
import { AuthorizationService } from "../authorization/authorization.service";
import { PushNotificationsService } from "../push/push-notifications.service";
import { CollaborationService } from "../realtime/collaboration.service";
import {
  acquireLegacyBlob,
  buildR2Client,
  cleanupOrphanR2Objects,
  releaseBlobRef,
  storeBlobFromBuffer,
} from "./attachments-storage.util";
import { DiscordNotifyService } from "../discord/discord-notify.service";

const MAX_FILES_PER_TASK = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_PREFIXES = ["image/", "application/pdf", "text/"];
const ALLOWED_MIME_EXACT = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p)) || ALLOWED_MIME_EXACT.has(mime);
}

const EXT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

function resolveMime(fileName: string, mimeType: string): string {
  const trimmed = mimeType.trim();
  if (trimmed) return trimmed;
  const ext = fileName.split(".").pop()?.toLowerCase();
  return (ext && EXT_MIME[ext]) || "application/octet-stream";
}

export type AttachmentUploadFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

@Injectable()
export class AttachmentsService {
  private readonly s3 = buildR2Client();
  private readonly bucket = process.env.R2_BUCKET_NAME ?? "";
  private readonly publicUrl = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");

  constructor(
    @Inject(DRIZZLE) private readonly db: AppDatabase,
    private readonly authz: AuthorizationService,
    private readonly collaboration: CollaborationService,
    private readonly discordNotify: DiscordNotifyService,
    private readonly pushNotifications: PushNotificationsService,
  ) {}

  private async notifyLedger(
    access: { task: { organizationId: string; title: string; assignerId: string } },
    userId: string,
    taskId: string,
    entry: typeof activityLedger.$inferSelect,
  ) {
    const assignees = await this.db
      .select({ userId: taskAssignees.userId })
      .from(taskAssignees)
      .where(eq(taskAssignees.taskId, taskId));

    void this.pushNotifications
      .notifyLedgerActivity({
        organizationId: access.task.organizationId,
        actorUserId: userId,
        taskId,
        taskTitle: access.task.title,
        assignerUserId: access.task.assignerId,
        assigneeUserIds: assignees.map((a) => a.userId),
        ledgerDelta: [entry],
      })
      .catch(() => {});
  }

  isR2Configured(): boolean {
    return Boolean(this.s3 && this.bucket);
  }

  private assertR2(): S3Client {
    if (!this.s3) throw new BadRequestException("File storage is not configured (R2 credentials missing)");
    return this.s3;
  }

  private newPresignStorageKey(taskId: string, fileName: string): string {
    return `attachments/${taskId}/${randomUUID()}/${fileName}`;
  }

  private async assertCanUpload(
    userId: string,
    taskId: string,
    mimeType: string,
    fileSize: number,
  ): Promise<Awaited<ReturnType<AuthorizationService["getTaskAccess"]>>> {
    const access = await this.authz.getTaskAccess(userId, taskId);
    const caps = this.authz.taskCapabilities(access, userId);
    if (!caps.canParticipate) throw new ForbiddenException("Cannot upload files to this task");

    if (!isAllowedMime(mimeType)) throw new BadRequestException("File type not allowed");
    if (fileSize > MAX_FILE_SIZE) throw new BadRequestException("File exceeds 10 MB limit");

    const [{ attachmentCount }] = await this.db
      .select({ attachmentCount: count() })
      .from(taskAttachments)
      .where(eq(taskAttachments.taskId, taskId));
    if ((attachmentCount ?? 0) >= MAX_FILES_PER_TASK) {
      throw new BadRequestException(`Task already has ${MAX_FILES_PER_TASK} attachments (maximum)`);
    }

    return access;
  }

  private async recordAttachment(
    userId: string,
    taskId: string,
    access: Awaited<ReturnType<AuthorizationService["getTaskAccess"]>>,
    opts: { blobId: string; fileName: string; fileSize: number; mimeType: string },
  ) {
    const [row] = await this.db
      .insert(taskAttachments)
      .values({
        taskId,
        blobId: opts.blobId,
        uploadedBy: userId,
        fileName: opts.fileName,
        fileSize: String(opts.fileSize),
        mimeType: opts.mimeType,
      })
      .returning();

    const [entry] = await this.db
      .insert(activityLedger)
      .values({
        taskId,
        actorId: userId,
        type: "attachment_added",
        payload: { fileName: opts.fileName, mimeType: opts.mimeType },
      })
      .returning();

    await this.notifyLedger(access, userId, taskId, entry!);
    this.collaboration.notifyOrgChanged(access.task.organizationId, taskId);
    return row;
  }

  /** Server-side upload with image compression and content-hash deduplication. Plain attachment — never touches Discord. */
  async upload(userId: string, taskId: string, file: AttachmentUploadFile) {
    const fileName = file.originalname.trim() || "upload";
    const mimeType = resolveMime(fileName, file.mimetype);
    const access = await this.assertCanUpload(userId, taskId, mimeType, file.size);

    const s3 = this.assertR2();
    const stored = await storeBlobFromBuffer(this.db, s3, this.bucket, file.buffer, mimeType);

    const row = await this.recordAttachment(userId, taskId, access, {
      blobId: stored.blobId,
      fileName,
      fileSize: file.size,
      mimeType,
    });

    return { ...row, storageKey: stored.storageKey, deduplicated: stored.deduplicated };
  }

  /**
   * "Discord submission" — a separate upload path from `upload()`. Stores the file exactly like a normal
   * attachment, but also synchronously posts it to the task's Discord channel and waits for the result,
   * so the caller gets immediate success/failure feedback instead of a silent background attempt.
   */
  async discordSubmit(userId: string, taskId: string, file: AttachmentUploadFile) {
    const submittedAt = new Date();
    const fileName = file.originalname.trim() || "upload";
    const mimeType = resolveMime(fileName, file.mimetype);
    const access = await this.assertCanUpload(userId, taskId, mimeType, file.size);

    if (!access.task.discordChannelId) {
      throw new BadRequestException("This task doesn't have a Discord channel assigned");
    }

    const s3 = this.assertR2();
    const stored = await storeBlobFromBuffer(this.db, s3, this.bucket, file.buffer, mimeType);

    const row = await this.recordAttachment(userId, taskId, access, {
      blobId: stored.blobId,
      fileName,
      fileSize: file.size,
      mimeType,
    });

    const delivery = await this.discordNotify.notifyAttachment({
      organizationId: access.task.organizationId,
      taskId,
      discordChannelId: access.task.discordChannelId,
      uploaderId: userId,
      fileName,
      mimeType,
      dueAt: access.task.dueAt,
      submittedAt,
      source: { fileBuffer: file.buffer },
    });

    let discordDeliveredAt: Date | null = null;
    if (delivery.ok) {
      discordDeliveredAt = new Date();
      await this.db
        .update(taskAttachments)
        .set({ discordDeliveredAt })
        .where(eq(taskAttachments.id, row.id));
      await this.db
        .update(tasks)
        .set({ lastSubmittedAt: discordDeliveredAt })
        .where(eq(tasks.id, taskId));
    }

    return {
      ...row,
      discordDeliveredAt,
      storageKey: stored.storageKey,
      deduplicated: stored.deduplicated,
      discord: delivery,
    };
  }

  async presign(userId: string, taskId: string, opts: { fileName: string; mimeType: string; fileSize: number }) {
    const mimeType = resolveMime(opts.fileName, opts.mimeType);
    await this.assertCanUpload(userId, taskId, mimeType, opts.fileSize);

    const s3 = this.assertR2();
    const storageKey = this.newPresignStorageKey(taskId, opts.fileName);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ContentType: mimeType,
      ContentLength: opts.fileSize,
    });
    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 900 });
    return { presignedUrl, storageKey };
  }

  async confirm(userId: string, taskId: string, opts: { storageKey: string; fileName: string; fileSize: number; mimeType: string }) {
    const mimeType = resolveMime(opts.fileName, opts.mimeType);
    const access = await this.assertCanUpload(userId, taskId, mimeType, opts.fileSize);

    if (!opts.storageKey.startsWith(`attachments/${taskId}/`)) {
      throw new BadRequestException("Invalid storage key");
    }

    const blobId = await acquireLegacyBlob(this.db, {
      storageKey: opts.storageKey,
      mimeType,
      byteSize: opts.fileSize,
    });

    return this.recordAttachment(userId, taskId, access, {
      blobId,
      fileName: opts.fileName,
      fileSize: opts.fileSize,
      mimeType,
    });
  }

  async listForTask(userId: string, taskId: string) {
    await this.authz.getTaskAccess(userId, taskId);
    const rows = await this.db
      .select({
        id: taskAttachments.id,
        taskId: taskAttachments.taskId,
        blobId: taskAttachments.blobId,
        uploadedBy: taskAttachments.uploadedBy,
        fileName: taskAttachments.fileName,
        fileSize: taskAttachments.fileSize,
        mimeType: taskAttachments.mimeType,
        discordDeliveredAt: taskAttachments.discordDeliveredAt,
        createdAt: taskAttachments.createdAt,
        storageKey: attachmentBlobs.storageKey,
      })
      .from(taskAttachments)
      .innerJoin(attachmentBlobs, eq(taskAttachments.blobId, attachmentBlobs.id))
      .where(eq(taskAttachments.taskId, taskId));

    return rows.map((r) => ({
      ...r,
      url: `${this.publicUrl}/${r.storageKey}`,
    }));
  }

  async remove(userId: string, attachmentId: string) {
    const [attachment] = await this.db
      .select()
      .from(taskAttachments)
      .where(eq(taskAttachments.id, attachmentId))
      .limit(1);
    if (!attachment) throw new NotFoundException("Attachment not found");

    const access = await this.authz.getTaskAccess(userId, attachment.taskId);
    const isUploader = attachment.uploadedBy === userId;
    if (!isUploader && !access.isOwner) throw new ForbiddenException("Cannot delete this attachment");

    await this.db.delete(taskAttachments).where(eq(taskAttachments.id, attachmentId));

    const s3 = this.assertR2();
    await releaseBlobRef(this.db, s3, this.bucket, attachment.blobId);

    const [entry] = await this.db
      .insert(activityLedger)
      .values({
        taskId: attachment.taskId,
        actorId: userId,
        type: "attachment_deleted",
        payload: { fileName: attachment.fileName },
      })
      .returning();

    await this.notifyLedger(access, userId, attachment.taskId, entry!);
    this.collaboration.notifyOrgChanged(access.task.organizationId, attachment.taskId);
  }

  async runOrphanCleanup(): Promise<{ scanned: number; deleted: number } | null> {
    if (!this.isR2Configured()) return null;
    return cleanupOrphanR2Objects(this.db, this.assertR2(), this.bucket);
  }

  /**
   * Releases blob refs (and deletes the attachment rows) for every attachment under the given tasks,
   * before those tasks are hard-deleted. Cascading FK deletes bypass `releaseBlobRef` entirely, which
   * otherwise leaks `attachment_blobs` rows and their R2 objects forever — callers that are about to
   * hard-delete a task (or a list/department/organization that cascades through tasks) must call this
   * first so ref-counts and storage stay accurate.
   */
  async releaseForTaskIds(taskIds: string[]): Promise<void> {
    if (taskIds.length === 0) return;
    const rows = await this.db
      .select({ id: taskAttachments.id, blobId: taskAttachments.blobId })
      .from(taskAttachments)
      .where(inArray(taskAttachments.taskId, taskIds));
    if (rows.length === 0) return;

    if (this.isR2Configured()) {
      const s3 = this.assertR2();
      for (const row of rows) {
        await releaseBlobRef(this.db, s3, this.bucket, row.blobId);
      }
    }
    await this.db.delete(taskAttachments).where(
      inArray(
        taskAttachments.id,
        rows.map((r) => r.id),
      ),
    );
  }
}
