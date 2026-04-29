CREATE TABLE "lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subtasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"title" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lists" ADD CONSTRAINT "lists_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lists" ADD CONSTRAINT "lists_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "lists_org_idx" ON "lists" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "lists_department_idx" ON "lists" USING btree ("department_id");
--> statement-breakpoint
CREATE INDEX "subtasks_task_idx" ON "subtasks" USING btree ("task_id");
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "list_id" uuid;
--> statement-breakpoint
INSERT INTO "lists" ("organization_id", "department_id", "name")
SELECT DISTINCT "organization_id", "department_id", 'General'
FROM "tasks";
--> statement-breakpoint
UPDATE "tasks" t
SET "list_id" = l."id"
FROM "lists" l
WHERE l."organization_id" = t."organization_id"
  AND l."department_id" = t."department_id";
--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "list_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "tasks_list_idx" ON "tasks" USING btree ("list_id");
--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_department_id_departments_id_fk";
--> statement-breakpoint
DROP INDEX "tasks_department_idx";
--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "department_id";
