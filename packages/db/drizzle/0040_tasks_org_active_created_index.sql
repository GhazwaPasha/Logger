CREATE INDEX "tasks_org_active_created_idx" ON "tasks" USING btree ("organization_id","deleted_at","created_at","id");
