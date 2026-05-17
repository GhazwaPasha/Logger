export const orgKeys = {
  all: ["organizations"] as const,
};

export const workspaceKeys = {
  all: ["workspace"] as const,
  workspace: (organizationId: string) => [...workspaceKeys.all, organizationId] as const,
  activity: (organizationId: string) => [...workspaceKeys.all, organizationId, "activity"] as const,
};

export const taskKeys = {
  all: ["task"] as const,
  detail: (taskId: string | null | undefined) => [...taskKeys.all, taskId ?? ""] as const,
};

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (orgId: string) => [...notificationKeys.all, orgId, "list"] as const,
  count: (orgId: string) => [...notificationKeys.all, orgId, "count"] as const,
};
