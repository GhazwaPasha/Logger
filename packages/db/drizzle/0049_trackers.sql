-- Trackers: a number target owned by one person, with daily/weekly check-ins. Additive only.
CREATE TABLE IF NOT EXISTS "trackers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "assignee_id" text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "created_by" text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "period_start" text NOT NULL,
  "period_end" text NOT NULL,
  "split" text DEFAULT 'day' NOT NULL,
  "check_in" text DEFAULT 'daily' NOT NULL,
  "working_days" jsonb DEFAULT '[1,2,3,4,5]'::jsonb NOT NULL,
  "reminder_time" text,
  "last_reminded_on" text,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trackers_org_idx" ON "trackers" ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trackers_assignee_idx" ON "trackers" ("assignee_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tracker_metrics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tracker_id" uuid NOT NULL REFERENCES "trackers"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "kind" text DEFAULT 'input' NOT NULL,
  "unit" text DEFAULT 'count' NOT NULL,
  "currency" text,
  "formula" jsonb,
  "target" double precision,
  "direction" text DEFAULT 'at_least' NOT NULL,
  "order_index" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tracker_metrics_tracker_idx" ON "tracker_metrics" ("tracker_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tracker_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tracker_id" uuid NOT NULL REFERENCES "trackers"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "entry_date" text NOT NULL,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tracker_entries_tracker_date_idx" ON "tracker_entries" ("tracker_id", "entry_date");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tracker_entry_values" (
  "entry_id" uuid NOT NULL REFERENCES "tracker_entries"("id") ON DELETE CASCADE,
  "metric_id" uuid NOT NULL REFERENCES "tracker_metrics"("id") ON DELETE CASCADE,
  "value" double precision NOT NULL,
  PRIMARY KEY ("entry_id", "metric_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tracker_entry_values_metric_idx" ON "tracker_entry_values" ("metric_id");
--> statement-breakpoint
-- Same wall as every other table (see 0044): the app connects as the owner, client roles get nothing.
ALTER TABLE "trackers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tracker_metrics" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tracker_entries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tracker_entry_values" ENABLE ROW LEVEL SECURITY;
