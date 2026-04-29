-- Run when Drizzle migration 0002 was never applied but the app expects `tasks.priority`
-- and extended `task_status` values. Safe to run multiple times.
--
-- From repo root (with DATABASE_URL set):
--   psql "$DATABASE_URL" -f packages/db/scripts/repair-tasks-priority-and-status.sql
--
-- Or paste into Neon SQL Editor.

-- 1) task_priority enum + tasks.priority column
DO $block$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority') THEN
    CREATE TYPE public.task_priority AS ENUM ('high', 'medium', 'low');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'priority'
  ) THEN
    ALTER TABLE public.tasks
      ADD COLUMN priority public.task_priority NOT NULL DEFAULT 'medium';
  END IF;
END
$block$;

-- 2) Extend task_status enum (skip labels that already exist)
DO $block$
DECLARE
  lbl text;
BEGIN
  FOREACH lbl IN ARRAY ARRAY['pending', 'assigned', 'late', 'cancelled']
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'task_status'
        AND e.enumlabel = lbl
    ) THEN
      EXECUTE format('ALTER TYPE public.task_status ADD VALUE %L', lbl);
    END IF;
  END LOOP;
END
$block$;

-- 3) Map legacy "open" to "pending" if that label still exists on rows
UPDATE public.tasks SET status = 'pending'::task_status WHERE status::text = 'open';

-- 4) Prefer default pending for new rows (no-op if already set)
ALTER TABLE public.tasks ALTER COLUMN status SET DEFAULT 'pending';
