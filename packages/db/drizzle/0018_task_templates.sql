CREATE TABLE "task_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_by" text NOT NULL,
	"name" text NOT NULL,
	"default_title" text,
	"default_priority" text,
	"default_due_repeat" text,
	"default_list_id" uuid,
	"default_subtasks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_default_list_id_lists_id_fk" FOREIGN KEY ("default_list_id") REFERENCES "public"."lists"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "task_templates_org_idx" ON "task_templates" USING btree ("organization_id");
