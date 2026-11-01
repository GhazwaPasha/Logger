-- LogBase agent (Ask): private per-user conversations, their messages, and a per-org daily usage counter
-- the API checks before every run.
CREATE TABLE IF NOT EXISTS "agent_threads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "task_id" uuid REFERENCES "tasks"("id") ON DELETE SET NULL,
  "pinned" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_message_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_threads_user_org_last_idx"
  ON "agent_threads" ("user_id", "organization_id", "last_message_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_threads_task_idx" ON "agent_threads" ("task_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "thread_id" uuid NOT NULL REFERENCES "agent_threads"("id") ON DELETE CASCADE,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "steps" jsonb,
  "model" text,
  "input_tokens" integer,
  "output_tokens" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_messages_thread_created_idx" ON "agent_messages" ("thread_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_usage_daily" (
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "day" text NOT NULL,
  "requests" integer DEFAULT 0 NOT NULL,
  "input_tokens" integer DEFAULT 0 NOT NULL,
  "output_tokens" integer DEFAULT 0 NOT NULL,
  PRIMARY KEY ("organization_id", "day")
);
--> statement-breakpoint
-- Same wall as every other table (see 0044): the app connects as the owner, client roles get nothing.
ALTER TABLE "agent_threads" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "agent_messages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "agent_usage_daily" ENABLE ROW LEVEL SECURITY;
