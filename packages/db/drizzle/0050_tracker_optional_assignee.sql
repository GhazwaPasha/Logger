-- A tracker can be set up before it is given to someone: the assignee becomes optional.
ALTER TABLE "trackers" ALTER COLUMN "assignee_id" DROP NOT NULL;
--> statement-breakpoint
-- New trackers count every day of the week unless told otherwise.
ALTER TABLE "trackers" ALTER COLUMN "working_days" SET DEFAULT '[1,2,3,4,5,6,7]'::jsonb;
