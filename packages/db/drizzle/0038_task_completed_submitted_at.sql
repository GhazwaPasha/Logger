ALTER TABLE "tasks" ADD COLUMN "completed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "last_submitted_at" timestamp with time zone;
--> statement-breakpoint
-- Backfill completed_at for tasks already sitting in "done": prefer the timestamp of their most
-- recent done-transition in the activity ledger; fall back to updated_at for legacy rows that
-- predate ledger tracking (or whose ledger history was since deleted).
UPDATE "tasks" t
SET "completed_at" = sub."created_at"
FROM (
	SELECT DISTINCT ON (task_id) task_id, created_at
	FROM "activity_ledger"
	WHERE type = 'status_change' AND payload ->> 'newStatus' = 'done'
	ORDER BY task_id, created_at DESC
) sub
WHERE t.id = sub.task_id AND t.status = 'done' AND t.completed_at IS NULL;
--> statement-breakpoint
UPDATE "tasks" SET "completed_at" = "updated_at" WHERE status = 'done' AND completed_at IS NULL;
--> statement-breakpoint
-- Backfill last_submitted_at from the newest successful Discord submission already on file.
UPDATE "tasks" t
SET "last_submitted_at" = sub."max_delivered"
FROM (
	SELECT task_id, MAX(discord_delivered_at) AS max_delivered
	FROM "task_attachments"
	WHERE discord_delivered_at IS NOT NULL
	GROUP BY task_id
) sub
WHERE t.id = sub.task_id;
