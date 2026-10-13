-- Denormalize the task's organization onto each ledger row so org-wide feeds read one index range
-- (organization_id, created_at, id) instead of first materializing every visible task id.
ALTER TABLE "activity_ledger" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
--> statement-breakpoint
-- Writers never set it: a trigger fills it from the task, so all existing insert paths stay correct.
CREATE OR REPLACE FUNCTION public.activity_ledger_set_organization() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT t.organization_id INTO NEW.organization_id FROM public.tasks t WHERE t.id = NEW.task_id;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS activity_ledger_set_organization ON "activity_ledger";
--> statement-breakpoint
CREATE TRIGGER activity_ledger_set_organization BEFORE INSERT ON "activity_ledger"
  FOR EACH ROW EXECUTE FUNCTION public.activity_ledger_set_organization();
--> statement-breakpoint
UPDATE "activity_ledger" al SET "organization_id" = t."organization_id"
  FROM "tasks" t WHERE t."id" = al."task_id" AND al."organization_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "activity_ledger" ALTER COLUMN "organization_id" SET NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activity_ledger_organization_id_organizations_id_fk') THEN
    ALTER TABLE "activity_ledger" ADD CONSTRAINT "activity_ledger_organization_id_organizations_id_fk"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_ledger_org_created_idx"
  ON "activity_ledger" ("organization_id", "created_at" DESC, "id" DESC);
