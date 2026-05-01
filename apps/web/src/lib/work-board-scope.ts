export type WorkBoardScope = { levelId: string | null; listId: string | null };

export const WORK_BOARD_SCOPE_EVENT = "wl:work-board-scope";

function key(workspaceId: string) {
  return `wl:workScope:${workspaceId}`;
}

export function readWorkBoardScope(workspaceId: string): WorkBoardScope | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key(workspaceId));
    if (!raw) return null;
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return null;
    const levelId = "levelId" in o ? (o as { levelId?: unknown }).levelId : null;
    const listId = "listId" in o ? (o as { listId?: unknown }).listId : null;
    return {
      levelId: typeof levelId === "string" ? levelId : null,
      listId: typeof listId === "string" ? listId : null,
    };
  } catch {
    return null;
  }
}

export function writeWorkBoardScope(workspaceId: string, scope: WorkBoardScope) {
  if (typeof window === "undefined") return;
  const prev = readWorkBoardScope(workspaceId);
  if (prev?.levelId === scope.levelId && prev?.listId === scope.listId) return;
  sessionStorage.setItem(key(workspaceId), JSON.stringify(scope));
  window.dispatchEvent(new Event(WORK_BOARD_SCOPE_EVENT));
}
