import type { QueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useRef } from 'react';

import { api } from '@/lib/api';
import { pendingCreations } from '@/lib/pending-creation';
import { markOwnWrite, qk, refreshTaskLists, syncActiveRow } from '@/lib/queries';
import type { TaskDetail, TaskMutationResult, TaskRow } from '@/lib/types';
import { useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/lib/workspace';

/** Title a fresh draft carries until the user names it (same sentinel as the web). */
export const TASK_DEFAULT_TITLE = 'Untitled task';
export const isDefaultTitle = (title: string) => title.trim() === TASK_DEFAULT_TITLE;


function uuid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Seeds the detail cache with a stub, fires the create POST in the background and returns the client id
 * so the editor can open instantly. Reads and patches of this task wait on `afterCreation`.
 */
function createDraftTask(qc: QueryClient, orgId: string, listId: string, assignerId: string): string {
  const id = uuid();
  const now = new Date().toISOString();
  const stub: TaskRow = {
    id,
    title: TASK_DEFAULT_TITLE,
    status: 'pending',
    priority: 'medium',
    dueAt: null,
    dueRepeat: null,
    listId,
    assignerId,
    deletedAt: null,
    assigneeUserIds: [],
    subtasks: [],
    createdAt: now,
    updatedAt: now,
  };
  qc.setQueryData<TaskDetail>(qk.task(id), {
    task: stub,
    capabilities: { canArchiveTask: false, canEditFields: true, canParticipate: true },
    assigneeUserIds: [],
    subtasks: [],
    ledger: [],
  });

  const creation = (async () => {
    try {
      markOwnWrite(id);
      const res = await api<TaskMutationResult>(`/organizations/${orgId}/tasks`, {
        method: 'POST',
        body: { id, title: TASK_DEFAULT_TITLE, listId, assigneeUserIds: [], status: 'pending', priority: 'medium' },
      });
      markOwnWrite(id);
      // The server only echoes the stub back, while edits made meanwhile (title, AI fill, checklist) sit
      // optimistically in the cache waiting on this POST: keep those, and take just what the server adds.
      qc.setQueryData<TaskDetail>(qk.task(id), (old) =>
        old
          ? {
              ...old,
              task: { ...res.task, ...old.task },
              capabilities: res.capabilities,
              ledger: [...res.ledgerDelta, ...old.ledger],
            }
          : old,
      );
      // The new task joins the lists: the dashboard's active list in place, mounted board columns refetch.
      const detail = qc.getQueryData<TaskDetail>(qk.task(id));
      if (detail) syncActiveRow(qc, { ...detail.task, assigneeUserIds: detail.assigneeUserIds, subtasks: detail.subtasks });
      void refreshTaskLists(qc);
    } catch {
      qc.removeQueries({ queryKey: qk.task(id) });
    } finally {
      pendingCreations.delete(id);
    }
  })();
  pendingCreations.set(id, creation);
  return id;
}

/** Opens the task editor on a brand-new draft — one screen, autosaved, like the web's `useOpenNewTask`. */
export function useOpenNewTask() {
  const qc = useQueryClient();
  const { org, lists, scope, userId } = useWorkspace();
  const busy = useRef(false);

  return useCallback(
    (presetListId?: string | null) => {
      if (!org || busy.current) return;
      const deptFirst = [...lists]
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .find((l) => l.departmentId === scope.levelId)?.id;
      const listId = presetListId ?? scope.listId ?? deptFirst ?? [...lists].sort((a, b) => a.orderIndex - b.orderIndex)[0]?.id;
      if (!listId) return;
      busy.current = true;
      const id = createDraftTask(qc, org.id, listId, userId ?? '');
      router.push({ pathname: '/task/[id]', params: { id, draft: '1' } });
      setTimeout(() => (busy.current = false), 600);
    },
    [qc, org, lists, scope, userId],
  );
}
