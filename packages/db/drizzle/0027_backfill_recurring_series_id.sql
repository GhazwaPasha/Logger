-- Backfill recurring_series_id on the first task of each recurring series.
-- Previously, the first task in a series kept recurring_series_id = NULL while its
-- spawned children used the first task's own id as their recurring_series_id. That made
-- the first task's id collide with a series group's key in the UI (duplicate React key).
UPDATE "tasks" AS t
SET "recurring_series_id" = t."id"
WHERE t."recurring_series_id" IS NULL
  AND EXISTS (
    SELECT 1 FROM "tasks" AS child
    WHERE child."recurring_series_id" = t."id"
  );
