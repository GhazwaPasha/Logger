export const orgKeys = {
  all: ["organizations"] as const,
};

export const workspaceKeys = {
  all: ["workspace"] as const,
  workspace: (organizationId: string) => [...workspaceKeys.all, organizationId] as const,
  activity: (organizationId: string) => [...workspaceKeys.all, organizationId, "activity"] as const,
  archivedTasks: (organizationId: string) => [...workspaceKeys.all, organizationId, "archived-tasks"] as const,
  deletionLog: (organizationId: string) => [...workspaceKeys.all, organizationId, "deletion-log"] as const,
  /** Pipeline card counts — deliberately its own query, not derived from `workspace()`'s paginated tasks. */
  taskCounts: (organizationId: string, listId?: string | null, departmentId?: string | null) =>
    [...workspaceKeys.all, organizationId, "task-counts", listId ?? "", departmentId ?? ""] as const,
  /** RecurringSeriesCard header stats, grouped by chain. */
  seriesSummary: (
    organizationId: string,
    statuses: readonly string[],
    listId?: string | null,
    departmentId?: string | null,
  ) => [...workspaceKeys.all, organizationId, "series-summary", statuses.join(","), listId ?? "", departmentId ?? ""] as const,
  /** Full occurrence list for one recurring chain — only fetched once its card is expanded. */
  seriesOccurrences: (organizationId: string, seriesId: string) =>
    [...workspaceKeys.all, organizationId, "series-occurrences", seriesId] as const,
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

export const performanceKeys = {
  all: ["performance"] as const,
  scorecards: (organizationId: string, dateFrom?: string, dateTo?: string) =>
    [...performanceKeys.all, organizationId, "scorecards", dateFrom ?? "", dateTo ?? ""] as const,
  memberTasks: (organizationId: string, userId: string, dateFrom?: string, dateTo?: string) =>
    [...performanceKeys.all, organizationId, "member-tasks", userId, dateFrom ?? "", dateTo ?? ""] as const,
};
