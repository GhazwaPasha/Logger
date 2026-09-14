-- Cleans up dangling task_assignees rows left over from member removals that happened before
-- the removeMember cleanup (apps/api/src/organizations/organizations.service.ts) started clearing
-- a departing member's assignments. task_assignees.user_id only cascades off the user account, not
-- off organization membership, so removing someone from a workspace left their old task
-- assignments in place. The assignee id then resolved against nothing in that org's member list,
-- so every UI surface fell back to showing "Unknown" instead of the task going back to unassigned.
--
-- Records one assignee_change ledger entry per affected task (actor = the task's assigner, since
-- who actually removed the member isn't recoverable from history) before removing the stale rows.

WITH orphaned AS (
  SELECT ta."task_id", ta."user_id"
  FROM "task_assignees" ta
  JOIN "tasks" t ON t."id" = ta."task_id"
  WHERE NOT EXISTS (
    SELECT 1 FROM "organization_members" om
    WHERE om."organization_id" = t."organization_id" AND om."user_id" = ta."user_id"
  )
),
affected_tasks AS (
  SELECT DISTINCT "task_id" FROM orphaned
),
before_state AS (
  SELECT ta."task_id", array_agg(ta."user_id" ORDER BY ta."user_id") AS previous_assignee_user_ids
  FROM "task_assignees" ta
  WHERE ta."task_id" IN (SELECT "task_id" FROM affected_tasks)
  GROUP BY ta."task_id"
),
after_state AS (
  SELECT at."task_id",
    COALESCE(
      array_agg(ta."user_id" ORDER BY ta."user_id") FILTER (WHERE ta."user_id" IS NOT NULL),
      ARRAY[]::text[]
    ) AS assignee_user_ids
  FROM affected_tasks at
  LEFT JOIN "task_assignees" ta
    ON ta."task_id" = at."task_id"
    AND NOT EXISTS (
      SELECT 1 FROM orphaned o WHERE o."task_id" = ta."task_id" AND o."user_id" = ta."user_id"
    )
  GROUP BY at."task_id"
)
INSERT INTO "activity_ledger" ("task_id", "actor_id", "type", "payload")
SELECT
  bs."task_id",
  t."assigner_id",
  'assignee_change',
  jsonb_build_object(
    'previousAssigneeUserIds', to_jsonb(bs.previous_assignee_user_ids),
    'assigneeUserIds', to_jsonb(a.assignee_user_ids)
  )
FROM before_state bs
JOIN after_state a ON a."task_id" = bs."task_id"
JOIN "tasks" t ON t."id" = bs."task_id";

DELETE FROM "task_assignees" ta
USING "tasks" t
WHERE ta."task_id" = t."id"
  AND NOT EXISTS (
    SELECT 1 FROM "organization_members" om
    WHERE om."organization_id" = t."organization_id" AND om."user_id" = ta."user_id"
  );
