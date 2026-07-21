ALTER TABLE "tasks" ADD COLUMN "attachment_required" boolean DEFAULT false NOT NULL;
ALTER TABLE "tasks" ADD COLUMN "time_tracking_enabled" boolean DEFAULT true NOT NULL;
