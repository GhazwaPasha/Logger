"use client";

import { useCallback, useEffect } from "react";
import type { ConfirmDialogOptions } from "@/components/ui/ConfirmDialog";

const LEAVE_CONFIRM: Omit<ConfirmDialogOptions, "onConfirm"> = {
  title: "Leave without saving?",
  description: "If you go back now, your changes will not be saved.",
  confirmLabel: "Leave anyway",
  variant: "danger",
};

const TITLE_REQUIRED_CONFIRM: Omit<ConfirmDialogOptions, "onConfirm"> = {
  title: "Task title required",
  description:
    "Add a title to keep this task. If you leave now, the task will be deleted and will not appear on the board.",
  confirmLabel: "Delete task",
  cancelLabel: "Keep editing",
  variant: "danger",
};

export function useTaskFormNavigationGuard(options: {
  hasUnsavedChanges: boolean;
  /** User has not provided a real title (draft / placeholder only). */
  requiresTitle?: boolean;
  onDeleteDraft?: () => void | Promise<void>;
  onLeave: () => void;
  setConfirm: (options: ConfirmDialogOptions | null) => void;
}) {
  const { hasUnsavedChanges, requiresTitle = false, onDeleteDraft, onLeave, setConfirm } = options;

  useEffect(() => {
    if (!hasUnsavedChanges && !requiresTitle) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges, requiresTitle]);

  const requestLeave = useCallback(() => {
    if (requiresTitle) {
      setConfirm({
        ...TITLE_REQUIRED_CONFIRM,
        onConfirm: () => onDeleteDraft?.() ?? undefined,
      });
      return;
    }
    if (hasUnsavedChanges) {
      setConfirm({
        ...LEAVE_CONFIRM,
        onConfirm: onLeave,
      });
    } else {
      onLeave();
    }
  }, [requiresTitle, hasUnsavedChanges, onDeleteDraft, onLeave, setConfirm]);

  return { requestLeave };
}
