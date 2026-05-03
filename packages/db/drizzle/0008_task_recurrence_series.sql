ALTER TABLE "tasks" ADD COLUMN "recurring_series_id" uuid;
ALTER TABLE "tasks" ADD COLUMN "spawned_from_task_id" uuid;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_spawned_from_task_id_tasks_id_fk" FOREIGN KEY ("spawned_from_task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
CREATE UNIQUE INDEX "tasks_spawned_from_parent_uidx" ON "tasks" ("spawned_from_task_id") WHERE spawned_from_task_id IS NOT NULL;
CREATE INDEX "tasks_recurring_series_idx" ON "tasks" ("recurring_series_id");
UPDATE "tasks" SET "recurring_series_id" = "id" WHERE "due_repeat" IS NOT NULL AND "recurring_series_id" IS NULL;
