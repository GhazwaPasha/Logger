-- 1. Rename tables first
ALTER TABLE "roadmap_items" RENAME TO "milestones";
--> statement-breakpoint
ALTER TABLE "roadmap_item_tasks" RENAME TO "milestone_tasks";
--> statement-breakpoint
ALTER TABLE "milestone_tasks" RENAME COLUMN "roadmap_item_id" TO "milestone_id";
--> statement-breakpoint

-- 2. Rename constraints/indexes to match the new table names
ALTER TABLE "milestones" RENAME CONSTRAINT "roadmap_items_pkey" TO "milestones_pkey";
--> statement-breakpoint
ALTER TABLE "milestones" RENAME CONSTRAINT "roadmap_items_organization_id_organizations_id_fk" TO "milestones_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "milestones" RENAME CONSTRAINT "roadmap_items_department_id_departments_id_fk" TO "milestones_department_id_departments_id_fk";
--> statement-breakpoint
ALTER TABLE "milestones" RENAME CONSTRAINT "roadmap_items_parent_id_roadmap_items_id_fk" TO "milestones_parent_id_milestones_id_fk";
--> statement-breakpoint
ALTER TABLE "milestones" RENAME CONSTRAINT "roadmap_items_owner_id_user_id_fk" TO "milestones_owner_id_user_id_fk";
--> statement-breakpoint
ALTER INDEX "roadmap_items_org_idx" RENAME TO "milestones_org_idx";
--> statement-breakpoint
ALTER INDEX "roadmap_items_parent_idx" RENAME TO "milestones_parent_idx";
--> statement-breakpoint

ALTER TABLE "milestone_tasks" RENAME CONSTRAINT "roadmap_item_tasks_roadmap_item_id_task_id_pk" TO "milestone_tasks_milestone_id_task_id_pk";
--> statement-breakpoint
ALTER TABLE "milestone_tasks" RENAME CONSTRAINT "roadmap_item_tasks_roadmap_item_id_roadmap_items_id_fk" TO "milestone_tasks_milestone_id_milestones_id_fk";
--> statement-breakpoint
ALTER TABLE "milestone_tasks" RENAME CONSTRAINT "roadmap_item_tasks_task_id_tasks_id_fk" TO "milestone_tasks_task_id_tasks_id_fk";
--> statement-breakpoint
ALTER INDEX "roadmap_item_tasks_task_idx" RENAME TO "milestone_tasks_task_idx";
--> statement-breakpoint

-- 3. Drop the period-scoped index and the period column/type — milestones are no longer bound to a fixed calendar ladder
DROP INDEX "roadmap_items_org_period_idx";
--> statement-breakpoint
ALTER TABLE "milestones" DROP COLUMN "period";
--> statement-breakpoint
DROP TYPE "public"."roadmap_period";
--> statement-breakpoint

-- 4. Create goals table
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"department_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"owner_id" text,
	"status" "roadmap_status" DEFAULT 'on_track' NOT NULL,
	"target_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "goals_org_idx" ON "goals" USING btree ("organization_id");
--> statement-breakpoint

-- 5. Add goal_id, nullable at first so existing rows can be backfilled before the constraint is enforced
ALTER TABLE "milestones" ADD COLUMN "goal_id" uuid;
--> statement-breakpoint

-- 6. Promote every existing root milestone (old parent_id IS NULL) into a new goal row
CREATE TEMP TABLE "goal_migration_map" ("old_root_id" uuid PRIMARY KEY, "new_goal_id" uuid NOT NULL) ON COMMIT DROP;
--> statement-breakpoint
INSERT INTO "goal_migration_map" ("old_root_id", "new_goal_id")
	SELECT "id", gen_random_uuid() FROM "milestones" WHERE "parent_id" IS NULL;
--> statement-breakpoint
INSERT INTO "goals" ("id", "organization_id", "department_id", "title", "description", "owner_id", "status", "target_date", "created_at", "updated_at")
	SELECT gm."new_goal_id", m."organization_id", m."department_id", m."title", m."description", m."owner_id", m."status", NULL, m."created_at", m."updated_at"
	FROM "milestones" m JOIN "goal_migration_map" gm ON gm."old_root_id" = m."id";
--> statement-breakpoint

-- 7. Backfill goal_id on every milestone (root and descendant) by resolving to its ultimate root ancestor
WITH RECURSIVE root_of AS (
	SELECT "id", "id" AS "root_id" FROM "milestones" WHERE "parent_id" IS NULL
	UNION ALL
	SELECT m."id", r."root_id" FROM "milestones" m JOIN root_of r ON m."parent_id" = r."id"
)
UPDATE "milestones" SET "goal_id" = gm."new_goal_id"
FROM root_of r JOIN "goal_migration_map" gm ON gm."old_root_id" = r."root_id"
WHERE "milestones"."id" = r."id";
--> statement-breakpoint

-- 8. Enforce NOT NULL + FK now that every row is backfilled
ALTER TABLE "milestones" ALTER COLUMN "goal_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "milestones_goal_idx" ON "milestones" USING btree ("goal_id");
