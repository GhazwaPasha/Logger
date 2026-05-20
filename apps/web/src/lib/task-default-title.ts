/** Server title used when the user has not named the task yet (create + empty PATCH). */
export const TASK_DEFAULT_TITLE = "Untitled task";

/** Shown in the title field when the user has not typed a name yet. */
export const TASK_TITLE_PLACEHOLDER = "Untitled Task";

export function isDefaultTaskTitle(title: string): boolean {
  return title.trim() === TASK_DEFAULT_TITLE;
}

/** Map persisted title → empty editor when still the placeholder. */
export function titleForDisplay(persisted: string): string {
  return isDefaultTaskTitle(persisted) ? "" : persisted;
}

/** Map editor value → API title (never empty). */
export function titleForPersist(editorValue: string): string {
  const t = editorValue.trim();
  return t.length > 0 ? t : TASK_DEFAULT_TITLE;
}

export function hasMeaningfulTitle(editorValue: string): boolean {
  return editorValue.trim().length > 0;
}
