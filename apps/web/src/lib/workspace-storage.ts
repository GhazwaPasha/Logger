const KEY = "wl.workspaceId";

export function getLastWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function setLastWorkspaceId(id: string) {
  localStorage.setItem(KEY, id);
}

export function clearLastWorkspaceId() {
  localStorage.removeItem(KEY);
}
