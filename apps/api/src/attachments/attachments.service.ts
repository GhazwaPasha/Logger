import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, count, eq } from "drizzle-orm";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { activityLedger, taskAttachments } from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { DRIZZLE } from "../db/drizzle.constants";
import { AuthorizationService } from "../authorization/authorization.service";
import { CollaborationService } from "../realtime/collaboration.service";

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

function buildS3Client(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

@Injectable()
export class AttachmentsService {
  private readonly s3 = buildS3Client();
  private readonly bucket = process.env.R2_BUCKET_NAME ?? "";
  private readonly publicUrl = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");

  constructor(
    @Inject(DRIZZLE) private readonly db: AppDatabase,
    private readonly authz: AuthorizationService,
    private readonly collaboration: CollaborationService,
  ) {}

  private assertR2(): S3Client {
    if (!this.s3) throw new BadRequestException("File storage is not configured (R2 credentials missing)");
    return this.s3;
  }

  async presign(userId: string, taskId: string, opts: { fileName: string; mimeType: string; fileSize: number }) {
    const access = await this.authz.getTaskAccess(userId, taskId);
    const caps = this.authz.taskCapabilities(access, userId);
    if (!caps.canAppendLedger) throw new ForbiddenException("Cannot upload files to this task");

    if (!isAllowedMime(opts.mimeType)) throw new BadRequestException("File type not allowed");
    if (opts.fileSize > MAX_FILE_SIZE) throw new BadRequestException("File exceeds 10 MB limit");

    const [{ attachmentCount }] = await this.db
      .select({ attachmentCount: count() })
      .from(taskAttachments)
      .where(eq(taskAttachments.taskId, taskId));
    if ((attachmentCount ?? 0) >= MAX_FILES_PER_TASK) {
      throw new BadRequestException(`Task already has ${MAX_FILES_PER_TASK} attachments (maximum)`);
    }

    const s3 = this.assertR2();
    const { randomUUID } = await import("node:crypto");
    const storageKey = `attachments/${taskId}/${randomUUID()}/${opts.fileName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ContentType: opts.mimeType,
      ContentLength: opts.fileSize,
    });
    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 900 });
    return { presignedUrl, storageKey };
  }

  async confirm(userId: string, taskId: string, opts: { storageKey: string; fileName: string; fileSize: number; mimeType: string }) {
    const access = await this.authz.getTaskAccess(userId, taskId);
    const caps = this.authz.taskCapabilities(access, userId);
    if (!caps.canAppendLedger) throw new ForbiddenException("Cannot add attachments to this task");

    if (!opts.storageKey.startsWith(`attachments/${taskId}/`)) {
      throw new BadRequestException("Invalid storage key");
    }

    const [row] = await this.db
      .insert(taskAttachments)
      .values({
        taskId,
        uploadedBy: userId,
        fileName: opts.fileName,
        fileSize: String(opts.fileSize),
        mimeType: opts.mimeType,
        storageKey: opts.storageKey,
      })
      .returning();

    await this.db.insert(activityLedger).values({
      taskId,
      actorId: userId,
      type: "attachment_added",
      payload: { fileName: opts.fileName, mimeType: opts.mimeType },
    });

    this.collaboration.notifyOrgChanged(access.task.organizationId, taskId);
    return row;
  }

  async listForTask(userId: string, taskId: string) {
    await this.authz.getTaskAccess(userId, taskId);
    const rows = await this.db
      .select()
      .from(taskAttachments)
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

    const s3 = this.assertR2();
    await s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: attachment.storageKey }));
    await this.db.delete(taskAttachments).where(eq(taskAttachments.id, attachmentId));

    await this.db.insert(activityLedger).values({
      taskId: attachment.taskId,
      actorId: userId,
      type: "attachment_deleted",
      payload: { fileName: attachment.fileName },
    });

    this.collaboration.notifyOrgChanged(access.task.organizationId, attachment.taskId);
  }
}
