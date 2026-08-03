ALTER TABLE "task_attachments" ALTER COLUMN "blob_id" DROP NOT NULL;
ALTER TABLE "task_attachments" ADD COLUMN "discord_message_url" text;
