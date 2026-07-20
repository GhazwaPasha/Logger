import { createHash } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { eq, sql } from "drizzle-orm";
import { attachmentBlobs } from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { prepareUploadBytes } from "./attachment-image.util";

export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/** Builds an R2-configured S3Client from env, or `null` if credentials are missing. */
export function buildR2Client(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  const config: S3ClientConfig = {
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  };
  return new S3Client(config);
}

export async function getObjectBuffer(s3: S3Client, bucket: string, storageKey: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: storageKey }));
  const bytes = await res.Body!.transformToByteArray();
  return Buffer.from(bytes);
}

export function contentAddressedStorageKey(contentSha256: string, storageSuffix: string): string {
  const suffix = storageSuffix || "";
  return `attachments/blobs/${contentSha256.slice(0, 2)}/${contentSha256}${suffix}`;
}

export async function putObject(
  s3: S3Client,
  bucket: string,
  storageKey: string,
  body: Buffer,
  mimeType: string,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      Body: body,
      ContentType: mimeType,
      ContentLength: body.length,
    }),
  );
}

export type StoreBlobResult = {
  blobId: string;
  storageKey: string;
  mimeType: string;
  byteSize: number;
  deduplicated: boolean;
};

/**
 * Compress (images), hash, deduplicate, and upload bytes. Returns an existing blob when SHA matches.
 */
export async function storeBlobFromBuffer(
  db: AppDatabase,
  s3: S3Client,
  bucket: string,
  rawBuffer: Buffer,
  mimeType: string,
): Promise<StoreBlobResult> {
  const prepared = await prepareUploadBytes(rawBuffer, mimeType);
  const contentSha256 = sha256Hex(prepared.buffer);
  const storageKey = contentAddressedStorageKey(contentSha256, prepared.storageSuffix);

  const [existing] = await db
    .select()
    .from(attachmentBlobs)
    .where(eq(attachmentBlobs.contentSha256, contentSha256))
    .limit(1);

  if (existing) {
    await db
      .update(attachmentBlobs)
      .set({ refCount: sql`${attachmentBlobs.refCount} + 1` })
      .where(eq(attachmentBlobs.id, existing.id));
    return {
      blobId: existing.id,
      storageKey: existing.storageKey,
      mimeType: existing.mimeType,
      byteSize: Number(existing.byteSize),
      deduplicated: true,
    };
  }

  await putObject(s3, bucket, storageKey, prepared.buffer, prepared.mimeType);

  const [blob] = await db
    .insert(attachmentBlobs)
    .values({
      contentSha256,
      storageKey,
      mimeType: prepared.mimeType,
      byteSize: String(prepared.buffer.length),
      refCount: 1,
    })
    .returning();

  return {
    blobId: blob!.id,
    storageKey: blob!.storageKey,
    mimeType: blob!.mimeType,
    byteSize: prepared.buffer.length,
    deduplicated: false,
  };
}

/** Presign/confirm path: one blob row per R2 key (no content dedup). */
export async function acquireLegacyBlob(
  db: AppDatabase,
  opts: { storageKey: string; mimeType: string; byteSize: number },
): Promise<string> {
  const legacyHash = `legacy:${opts.storageKey}`;
  const [existing] = await db
    .select({ id: attachmentBlobs.id })
    .from(attachmentBlobs)
    .where(eq(attachmentBlobs.contentSha256, legacyHash))
    .limit(1);

  if (existing) {
    await db
      .update(attachmentBlobs)
      .set({ refCount: sql`${attachmentBlobs.refCount} + 1` })
      .where(eq(attachmentBlobs.id, existing.id));
    return existing.id;
  }

  const [blob] = await db
    .insert(attachmentBlobs)
    .values({
      contentSha256: legacyHash,
      storageKey: opts.storageKey,
      mimeType: opts.mimeType,
      byteSize: String(opts.byteSize),
      refCount: 1,
    })
    .returning();
  return blob!.id;
}

/** After deleting a task_attachment row, drop R2 object when no references remain. */
export async function releaseBlobRef(
  db: AppDatabase,
  s3: S3Client,
  bucket: string,
  blobId: string,
): Promise<void> {
  const [blob] = await db
    .update(attachmentBlobs)
    .set({ refCount: sql`GREATEST(${attachmentBlobs.refCount} - 1, 0)` })
    .where(eq(attachmentBlobs.id, blobId))
    .returning();

  if (!blob || blob.refCount > 0) return;

  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: blob.storageKey }));
  await db.delete(attachmentBlobs).where(eq(attachmentBlobs.id, blobId));
}

const ORPHAN_MIN_AGE_MS = 24 * 60 * 60 * 1000;

export async function cleanupOrphanR2Objects(
  db: AppDatabase,
  s3: S3Client,
  bucket: string,
): Promise<{ scanned: number; deleted: number }> {
  const knownRows = await db.select({ storageKey: attachmentBlobs.storageKey }).from(attachmentBlobs);
  const known = new Set(knownRows.map((r) => r.storageKey));

  const cutoff = Date.now() - ORPHAN_MIN_AGE_MS;
  let continuationToken: string | undefined;
  let scanned = 0;
  let deleted = 0;

  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: "attachments/",
        ContinuationToken: continuationToken,
      }),
    );

    for (const obj of page.Contents ?? []) {
      if (!obj.Key) continue;
      scanned += 1;
      if (known.has(obj.Key)) continue;
      const lastMod = obj.LastModified?.getTime() ?? 0;
      if (lastMod > cutoff) continue;

      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key }));
      deleted += 1;
    }

    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);

  return { scanned, deleted };
}
