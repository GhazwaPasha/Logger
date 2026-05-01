CREATE TABLE "organization_member_managed_departments" (
	"organization_member_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ommd_pk" PRIMARY KEY("organization_member_id","department_id")
);
--> statement-breakpoint
ALTER TABLE "organization_member_managed_departments" ADD CONSTRAINT "ommd_member_fk" FOREIGN KEY ("organization_member_id") REFERENCES "public"."organization_members"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "organization_member_managed_departments" ADD CONSTRAINT "ommd_dept_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "organization_member_managed_departments_dept_idx" ON "organization_member_managed_departments" USING btree ("department_id");
--> statement-breakpoint
INSERT INTO "organization_member_managed_departments" ("organization_member_id", "department_id")
SELECT "id", "department_id" FROM "organization_members"
WHERE "role" = 'manager' AND "department_id" IS NOT NULL;
