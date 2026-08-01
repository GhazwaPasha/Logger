ALTER TYPE "public"."ledger_type" ADD VALUE 'unarchive';
--> statement-breakpoint
ALTER TYPE "public"."ledger_type" ADD VALUE 'comment_restored';
--> statement-breakpoint
CREATE TYPE "public"."deletion_entity_type" AS ENUM('task', 'list', 'department', 'organization', 'goal', 'milestone', 'discord_integration');
--> statement-breakpoint
CREATE TABLE "deletion_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "deletion_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deletion_log" ADD CONSTRAINT "deletion_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "deletion_log_org_created_idx" ON "deletion_log" USING btree ("organization_id","created_at");
