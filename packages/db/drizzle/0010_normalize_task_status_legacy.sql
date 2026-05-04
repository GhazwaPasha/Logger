-- Retire automated statuses: map to manual workflow stages (assignees / overdue are UI-only signals now).
UPDATE tasks SET status = 'pending' WHERE status = 'assigned';
UPDATE tasks SET status = 'in_progress' WHERE status = 'late';
