"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTaskFieldsSync } from "@/hooks/useTaskFieldsSync";
import {
  manualStatusFromStored,
  normalizeTaskStatus,
  taskPriority,
  type ManualTaskStatus,
  type TaskPriority,
} from "@/lib/task-board";
import { parseTaskDueRepeat, type TaskDetail, type TaskDueRepeat } from "@/lib/ledger-types";
import {
  titleForDisplay,
  titleForPersist,
} from "@/lib/task-default-title";

function dueAtToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function useTaskEditorForm(options: {
  taskId: string;
  workspaceId: string;
  token: string | null;
  detail: TaskDetail | null | undefined;
}) {
  const { taskId, workspaceId, token, detail } = options;

  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<ManualTaskStatus>("pending");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [listId, setListId] = useState("");
  const [due, setDue] = useState("");
  const [dueRepeat, setDueRepeat] = useState<TaskDueRepeat | null>(null);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [discordChannelId, setDiscordChannelId] = useState<string | null>(null);
  const [discordSubmissionRequired, setDiscordSubmissionRequiredState] = useState(true);
  const [attachmentRequired, setAttachmentRequiredState] = useState(false);
  const [timeTrackingEnabled, setTimeTrackingEnabledState] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!due.trim()) setDueRepeat(null);
  }, [due]);

  const formFingerprint = useMemo(
    () =>
      JSON.stringify({
        title: titleForPersist(title),
        status,
        priority,
        listId,
        due,
        dueRepeat,
        assigneeIds: [...assigneeIds].sort(),
        discordChannelId,
        discordSubmissionRequired,
        attachmentRequired,
        timeTrackingEnabled,
      }),
    [
      title,
      status,
      priority,
      listId,
      due,
      dueRepeat,
      assigneeIds,
      discordChannelId,
      discordSubmissionRequired,
      attachmentRequired,
      timeTrackingEnabled,
    ],
  );

  const { status: syncStatus, error: syncError, hasUnsavedChanges, establishBaseline, flushSave, dueFieldPatch, seedSavedDueAt } =
    useTaskFieldsSync({
      workspaceId,
      token,
      taskId,
      ready: initialized && !!detail && !!token,
      fingerprint: formFingerprint,
      buildPatchPayload: () => ({
        title: titleForPersist(title),
        status,
        priority,
        listId,
        assigneeUserIds: assigneeIds,
        dueRepeat,
        discordChannelId,
        discordSubmissionRequired,
        attachmentRequired,
        timeTrackingEnabled,
        ...dueFieldPatch(due),
      }),
      debounceMs: 400,
    });

  useEffect(() => {
    if (!detail || initialized) return;
    setTitle(titleForDisplay(detail.task.title));
    setAssigneeIds([...detail.assigneeUserIds]);
    setDue(dueAtToLocalInput(detail.task.dueAt));
    setDueRepeat(parseTaskDueRepeat(detail.task.dueRepeat));
    setStatus(manualStatusFromStored(normalizeTaskStatus(detail.task.status)));
    setPriority(taskPriority(detail.task));
    setListId(detail.task.listId);
    setDiscordChannelId(detail.task.discordChannelId ?? null);
    setDiscordSubmissionRequiredState(detail.task.discordSubmissionRequired ?? true);
    setAttachmentRequiredState(detail.task.attachmentRequired ?? false);
    setTimeTrackingEnabledState(detail.task.timeTrackingEnabled ?? false);
    seedSavedDueAt(detail.task.dueAt);
    setInitialized(true);
  }, [detail, initialized, seedSavedDueAt]);

  const baselineEstablishedRef = useRef(false);
  useLayoutEffect(() => {
    if (!initialized || !detail || baselineEstablishedRef.current) return;
    baselineEstablishedRef.current = true;
    establishBaseline(formFingerprint);
  }, [initialized, detail, establishBaseline, formFingerprint]);

  const scheduleSave = useCallback(() => {
    queueMicrotask(() => flushSave());
  }, [flushSave]);

  const toggleAssignee = useCallback(
    (id: string) => {
      setAssigneeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
      queueMicrotask(() => flushSave());
    },
    [flushSave],
  );

  const setDiscordChannel = useCallback(
    (channelId: string | null) => {
      setDiscordChannelId(channelId);
      queueMicrotask(() => flushSave());
    },
    [flushSave],
  );

  const setDiscordSubmissionRequired = useCallback(
    (v: boolean) => {
      setDiscordSubmissionRequiredState(v);
      queueMicrotask(() => flushSave());
    },
    [flushSave],
  );

  const setAttachmentRequired = useCallback(
    (v: boolean) => {
      setAttachmentRequiredState(v);
      queueMicrotask(() => flushSave());
    },
    [flushSave],
  );

  const setTimeTrackingEnabled = useCallback(
    (v: boolean) => {
      setTimeTrackingEnabledState(v);
      queueMicrotask(() => flushSave());
    },
    [flushSave],
  );

  return {
    title,
    setTitle,
    status,
    setStatus,
    priority,
    setPriority,
    listId,
    setListId,
    due,
    setDue,
    dueRepeat,
    setDueRepeat,
    assigneeIds,
    setAssigneeIds,
    toggleAssignee,
    discordChannelId,
    setDiscordChannel,
    discordSubmissionRequired,
    setDiscordSubmissionRequired,
    attachmentRequired,
    setAttachmentRequired,
    timeTrackingEnabled,
    setTimeTrackingEnabled,
    initialized,
    formFingerprint,
    syncStatus,
    syncError,
    hasUnsavedChanges,
    flushSave,
    scheduleSave,
  };
}
