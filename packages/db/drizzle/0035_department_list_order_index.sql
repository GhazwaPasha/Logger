ALTER TABLE "departments" ADD COLUMN "order_index" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "order_index" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
-- Backfill existing rows with their current alphabetical order so drag-reordering starts from
-- the order users already see today, instead of every row defaulting to the same position.
WITH ranked AS (
	SELECT "id", ROW_NUMBER() OVER (PARTITION BY "organization_id" ORDER BY "name") - 1 AS rn
	FROM "departments"
)
UPDATE "departments" d SET "order_index" = ranked.rn
FROM ranked WHERE ranked.id = d.id;
--> statement-breakpoint
WITH ranked AS (
	SELECT "id", ROW_NUMBER() OVER (PARTITION BY "department_id" ORDER BY "name") - 1 AS rn
	FROM "lists"
)
UPDATE "lists" l SET "order_index" = ranked.rn
FROM ranked WHERE ranked.id = l.id;
