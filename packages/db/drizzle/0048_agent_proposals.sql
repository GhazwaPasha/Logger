-- Ask LogBase, phase 2: changes the agent proposes. Nothing runs until the user approves the card.
CREATE TABLE IF NOT EXISTS "agent_proposals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "thread_id" uuid NOT NULL REFERENCES "agent_threads"("id") ON DELETE CASCADE,
  "message_id" uuid REFERENCES "agent_messages"("id") ON DELETE SET NULL,
  "kind" text NOT NULL,
  "summary" text NOT NULL,
  "items" jsonb NOT NULL,
  "payload" jsonb NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "result" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_proposals_thread_idx" ON "agent_proposals" ("thread_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_proposals_user_status_idx" ON "agent_proposals" ("user_id", "status");
--> statement-breakpoint
-- Same wall as every other table (see 0044): the app connects as the owner, client roles get nothing.
ALTER TABLE "agent_proposals" ENABLE ROW LEVEL SECURITY;
