export const orgKeys = {
  all: ["organizations"] as const,
};

export const workspaceKeys = {
  all: ["workspace"] as const,
  workspace: (organizationId: string) => [...workspaceKeys.all, organizationId] as const,
  activity: (organizationId: string) => [...workspaceKeys.all, organizationId, "activity"] as const,
  archivedTasks: (organizationId: string) => [...workspaceKeys.all, organizationId, "archived-tasks"] as const,
  deletionLog: (organizationId: string) => [...workspaceKeys.all, organizationId, "deletion-log"] as const,
};

export const taskKeys = {
  all: ["task"] as const,
  detail: (taskId: string | null | undefined) => [...taskKeys.all, taskId ?? ""] as const,
};

export const roadmapKeys = {
  all: ["roadmap"] as const,
  tree: (organizationId: string) => [...roadmapKeys.all, organizationId] as const,
};

export const discordKeys = {
  all: ["discord"] as const,
  integration: (organizationId: string) => [...discordKeys.all, organizationId, "integration"] as const,
  channels: (organizationId: string) => [...discordKeys.all, organizationId, "channels"] as const,
};
