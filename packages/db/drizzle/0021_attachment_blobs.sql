CREATE TABLE "attachment_blobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_sha256" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" text NOT NULL,
	"ref_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attachment_blobs_content_sha256_unique" UNIQUE("content_sha256"),
	CONSTRAINT "attachment_blobs_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
INSERT INTO "attachment_blobs" ("id", "content_sha256", "storage_key", "mime_type", "byte_size", "ref_count", "created_at")
SELECT
	gen_random_uuid(),
	'legacy:' || "storage_key",
	"storage_key",
	MIN("mime_type"),
	MIN("file_size"),
	COUNT(*)::integer,
	MIN("created_at")
FROM "task_attachments"
GROUP BY "storage_key";
--> statement-breakpoint
ALTER TABLE "task_attachments" ADD COLUMN "blob_id" uuid;
--> statement-breakpoint
UPDATE "task_attachments" AS ta
SET "blob_id" = ab."id"
FROM "attachment_blobs" AS ab
WHERE ab."storage_key" = ta."storage_key";
--> statement-breakpoint
ALTER TABLE "task_attachments" ALTER COLUMN "blob_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_blob_id_attachment_blobs_id_fk" FOREIGN KEY ("blob_id") REFERENCES "public"."attachment_blobs"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_attachments" DROP CONSTRAINT "task_attachments_storage_key_unique";
--> statement-breakpoint
ALTER TABLE "task_attachments" DROP COLUMN "storage_key";
