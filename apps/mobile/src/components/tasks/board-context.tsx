import { createContext, useContext } from 'react';

import type { TaskPatch } from '@/lib/queries';

/** Everything a task card needs from the screen that renders it (so cards stay presentational and memoizable). */
export type BoardActions = {
  openTask: (taskId: string) => void;
  patchTask: (taskId: string, patch: TaskPatch) => void;
  setSubtaskDone: (taskId: string, subtaskId: string, done: boolean) => void;
  /** Tasks with a save in flight. */
  syncingIds: Set<string>;
  timeZone: string;
};

export const BoardActionsContext = createContext<BoardActions | null>(null);

export function useBoardActions(): BoardActions {
  const ctx = useContext(BoardActionsContext);
  if (!ctx) throw new Error('useBoardActions must be used inside a board');
  return ctx;
}
