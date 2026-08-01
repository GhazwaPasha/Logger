-- Backfills three gaps in previously-spawned recurring task instances, all caused by the
-- recurrence-spawn logic in tasks.service.ts not copying certain data from the parent task.
-- These only affect tasks with spawned_from_task_id set (i.e. auto-created "next occurrence" rows).

-- 1) Ledger attribution: the "Task created." note and the initial assignee_change entry on a
--    spawned task were recorded with actor_id = whoever completed the *previous* occurrence,
--    instead of the task's own assigner. This made the activity feed read as
--    "<assignee> assigned this task to <assignee>" instead of "<assigner> assigned this task to <assignee>".
--    Safe: only relabels the actor on these two specific auto-generated entry shapes.
UPDATE "activity_ledger" AS al
SET "actor_id" = t."assigner_id"
FROM "tasks" AS t
WHERE al."task_id" = t."id"
  AND t."spawned_from_task_id" IS NOT NULL
  AND al."actor_id" <> t."assigner_id"
  AND (
    (al."type" = 'note' AND al."payload" ->> 'message' = 'Task created.')
    OR (al."type" = 'assignee_change' AND al."payload" -> 'previousAssigneeUserIds' = '[]'::jsonb)
  );

-- 2) Subtasks were never copied to spawned tasks. Best-effort: only fills in children that
--    currently have zero subtasks, cloning from the parent's *current* subtask list (reset to
--    not-done). Skips any child that already has at least one subtask, to avoid duplicating
--    subtasks someone may have manually re-added after noticing they were missing.
--
--    Wrapped in a loop because a single pass only sees pre-statement state: in a multi-level
--    recurring chain (grandparent -> parent -> child), backfilling the parent's subtasks and
--    the child's subtasks happens in the same statement snapshot, so the child can't yet see
--    subtasks just inserted into its own parent. Repeat until a pass inserts nothing.
DO $$
DECLARE
  inserted_count integer;
BEGIN
  LOOP
    WITH targets AS (
      SELECT child."id" AS child_id, child."spawned_from_task_id" AS parent_id
      FROM "tasks" AS child
      WHERE child."spawned_from_task_id" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "subtasks" s WHERE s."task_id" = child."id")
        AND EXISTS (SELECT 1 FROM "subtasks" ps WHERE ps."task_id" = child."spawned_from_task_id")
    ),
    ordered_parent_subtasks AS (
      SELECT t.child_id, ps."title", row_number() OVER (PARTITION BY t.child_id ORDER BY ps."created_at") AS rn
      FROM targets t
      JOIN "subtasks" ps ON ps."task_id" = t.parent_id
    ),
    inserted AS (
      INSERT INTO "subtasks" ("task_id", "title", "done", "created_at")
      SELECT child_id, "title", false, now() + (rn * interval '1 millisecond')
      FROM ordered_parent_subtasks
      RETURNING 1
    )
    SELECT count(*) INTO inserted_count FROM inserted;

    EXIT WHEN inserted_count = 0;
  END LOOP;
END $$;

-- 3) discord_channel_id / discord_submission_required / attachment_required / time_tracking_enabled
--    were never copied to spawned tasks, silently resetting to column defaults. Best-effort: only
--    overwrites a child field that is still sitting at its default value, so a deliberate later
--    change on the child (e.g. someone manually disabling Discord posting) is left untouched.
UPDATE "tasks" AS child
SET
  "discord_channel_id" = COALESCE(child."discord_channel_id", parent."discord_channel_id"),
  "discord_submission_required" = CASE
    WHEN child."discord_submission_required" = true THEN parent."discord_submission_required"
    ELSE child."discord_submission_required"
  END,
  "attachment_required" = CASE
    WHEN child."attachment_required" = false THEN parent."attachment_required"
    ELSE child."attachment_required"
  END,
  "time_tracking_enabled" = CASE
    WHEN child."time_tracking_enabled" = false THEN parent."time_tracking_enabled"
    ELSE child."time_tracking_enabled"
  END
FROM "tasks" AS parent
WHERE child."spawned_from_task_id" = parent."id"
  AND (
    (child."discord_channel_id" IS NULL AND parent."discord_channel_id" IS NOT NULL)
    OR (child."discord_submission_required" = true AND parent."discord_submission_required" = false)
    OR (child."attachment_required" = false AND parent."attachment_required" = true)
    OR (child."time_tracking_enabled" = false AND parent."time_tracking_enabled" = true)
  );
