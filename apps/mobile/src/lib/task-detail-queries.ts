import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';

/**
 * Extra task-detail resources beyond `TaskDetail` (subtasks/ledger/capabilities) — attachments,
 * dependencies, time entries, and org Discord channels. Split from `queries.ts` since these are
 * only ever needed once a task is actually open, unlike the board-wide hooks there.
 */

// ---------------------------------------------------------------------------------------------
// Attachments — direct upload is disabled server-side (org-wide); only Discord submission works.
// ---------------------------------------------------------------------------------------------

export type AttachmentRow = {
  id: string;
  taskId: string;
  uploadedBy: string;
  fileName: string;
  fileSize: string;
  mimeType: string;
  /** Null for Discord-only submissions — the file lives only in Discord, `url` is a message permalink. */
  storageKey: string | null;
  url: string;
  discordDeliveredAt: string | null;
  createdAt: string;
};

export function useAttachments(taskId: string | undefined) {
  return useQuery({
    queryKey: ['attachments', taskId ?? ''],
    enabled: !!taskId,
    staleTime: 30_000,
    queryFn: () => api<AttachmentRow[]>(`/tasks/${taskId}/attachments`),
  });
}

export function useDeleteAttachment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) => api(`/attachments/${attachmentId}`, { method: 'DELETE' }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['attachments', taskId] }),
  });
}

export type DiscordSubmitResult = { discord: { ok: true } | { ok: false; reason: string } };

/** Posts a picked file straight to the task's Discord channel; on success it also shows up in `useAttachments`. */
export function useDiscordSubmit(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: { uri: string; name: string; mimeType?: string }) => {
      const form = new FormData();
      // React Native's fetch accepts this {uri,name,type} shape in place of a real Blob/File.
      form.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' } as unknown as Blob);
      return api<DiscordSubmitResult>(`/tasks/${taskId}/attachments/discord-submit`, {
        method: 'POST',
        body: form,
        timeoutMs: 120_000,
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['attachments', taskId] }),
  });
}

// ---------------------------------------------------------------------------------------------
// Dependencies — read-only here, matching the web's tap-into-a-task view (editing lives in the
// full editor page, which mobile doesn't have a separate route for).
// ---------------------------------------------------------------------------------------------

export type DependencyTaskRow = { id: string; title: string; status: string };

export function useBlockers(taskId: string | undefined) {
  return useQuery({
    queryKey: ['dependencies', 'blockers', taskId ?? ''],
    enabled: !!taskId,
    staleTime: 30_000,
    queryFn: () => api<DependencyTaskRow[]>(`/tasks/${taskId}/dependencies/blockers`),
  });
}

export function useBlocking(taskId: string | undefined) {
  return useQuery({
    queryKey: ['dependencies', 'blocking', taskId ?? ''],
    enabled: !!taskId,
    staleTime: 30_000,
    queryFn: () => api<DependencyTaskRow[]>(`/tasks/${taskId}/dependencies/blocking`),
  });
}

// ---------------------------------------------------------------------------------------------
// Time tracking — view-only here too (start/stop and manual logging live in the full editor on web).
// ---------------------------------------------------------------------------------------------

export type TimeEntryRow = {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  startedAt: string;
  stoppedAt: string | null;
  duration: string | null;
  note: string | null;
  createdAt: string;
};

export function useTimeEntries(taskId: string | undefined) {
  return useQuery({
    queryKey: ['time', taskId ?? ''],
    enabled: !!taskId,
    staleTime: 30_000,
    queryFn: () => api<TimeEntryRow[]>(`/tasks/${taskId}/time`),
  });
}

// ---------------------------------------------------------------------------------------------
// Discord channels — resolves a task's `discordChannelId` to a display name.
// ---------------------------------------------------------------------------------------------

export type DiscordChannelOption = { id: string; name: string; position: number; isPrivate: boolean };

export function useDiscordChannels(orgId: string | undefined) {
  return useQuery({
    queryKey: ['discord-channels', orgId ?? ''],
    enabled: !!orgId,
    staleTime: 60_000,
    queryFn: () => api<DiscordChannelOption[]>(`/organizations/${orgId}/discord-channels`),
  });
}
