/** Background create POSTs of draft tasks, keyed by client-generated task id. */
export const pendingCreations = new Map<string, Promise<void>>();

/** Resolves once a draft's create POST has settled (immediately for any other task). */
export function afterCreation(taskId: string): Promise<void> {
  return pendingCreations.get(taskId) ?? Promise.resolve();
}
