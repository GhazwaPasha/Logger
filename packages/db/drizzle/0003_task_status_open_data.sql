UPDATE "tasks" SET "status" = 'pending' WHERE "status" = 'open';
--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'pending';
