CREATE TYPE "public"."roadmap_period" AS ENUM('yearly', 'quarterly', 'monthly', 'weekly');
--> statement-breakpoint
CREATE TYPE "public"."roadmap_status" AS ENUM('on_track', 'at_risk', 'done', 'archived');
--> statement-breakpoint
CREATE TABLE "roadmap_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"department_id" uuid,
	"parent_id" uuid,
	"period" "roadmap_period" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"owner_id" text,
	"status" "roadmap_status" DEFAULT 'on_track' NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roadmap_item_tasks" (
	"roadmap_item_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roadmap_item_tasks_roadmap_item_id_task_id_pk" PRIMARY KEY("roadmap_item_id","task_id")
);
--> statement-breakpoint
ALTER TABLE "roadmap_items" ADD CONSTRAINT "roadmap_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "roadmap_items" ADD CONSTRAINT "roadmap_items_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "roadmap_items" ADD CONSTRAINT "roadmap_items_parent_id_roadmap_items_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."roadmap_items"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "roadmap_items" ADD CONSTRAINT "roadmap_items_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "roadmap_item_tasks" ADD CONSTRAINT "roadmap_item_tasks_roadmap_item_id_roadmap_items_id_fk" FOREIGN KEY ("roadmap_item_id") REFERENCES "public"."roadmap_items"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "roadmap_item_tasks" ADD CONSTRAINT "roadmap_item_tasks_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "roadmap_items_org_idx" ON "roadmap_items" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "roadmap_items_parent_idx" ON "roadmap_items" USING btree ("parent_id");
--> statement-breakpoint
CREATE INDEX "roadmap_items_org_period_idx" ON "roadmap_items" USING btree ("organization_id","period");
--> statement-breakpoint
CREATE INDEX "roadmap_item_tasks_task_idx" ON "roadmap_item_tasks" USING btree ("task_id");
