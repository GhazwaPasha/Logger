import type { AgentTaskFormFill, AskAgentInput } from '@work-ledger/contracts';

/**
 * The task screen offers itself here while it's open, so Ask (a screen pushed on top of it) can read the task as it
 * stands and fill it in, the same way the web's sidebar does. One at a time: there's one task screen in focus.
 */
export type AskTaskForm = {
  taskId: string;
  getState: () => NonNullable<AskAgentInput['taskForm']>;
  apply: (fill: AgentTaskFormFill) => void;
};

let active: AskTaskForm | null = null;

export function registerAskTaskForm(form: AskTaskForm): () => void {
  active = form;
  return () => {
    if (active === form) active = null;
  };
}

/** The open form for this task, if it's on screen and the user can edit it. */
export function getAskTaskForm(taskId: string | null | undefined): AskTaskForm | null {
  return taskId && active?.taskId === taskId ? active : null;
}
