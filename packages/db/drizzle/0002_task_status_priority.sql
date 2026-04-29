CREATE TYPE "public"."task_priority" AS ENUM('high', 'medium', 'low');
--> statement-breakpoint
ALTER TYPE "public"."task_status" ADD VALUE 'pending';
--> statement-breakpoint
ALTER TYPE "public"."task_status" ADD VALUE 'assigned';
--> statement-breakpoint
ALTER TYPE "public"."task_status" ADD VALUE 'late';
--> statement-breakpoint
ALTER TYPE "public"."task_status" ADD VALUE 'cancelled';
--> statement-breakpoint
UPDATE "tasks" SET "status" = 'pending' WHERE "status" = 'open';
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "priority" "task_priority" DEFAULT 'medium' NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'pending';
