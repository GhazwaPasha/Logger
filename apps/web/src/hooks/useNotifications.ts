"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson, apiFetch } from "@/lib/api";
import { notificationKeys } from "@/lib/query-keys";

export type NotificationRow = {
  id: string;
  userId: string;
  organizationId: string;
  taskId: string | null;
  type: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export function useNotifications(token: string | null, orgId: string | null) {
  return useQuery({
    queryKey: notificationKeys.list(orgId ?? ""),
    queryFn: () =>
      apiJson<NotificationRow[]>(`/notifications?orgId=${orgId!}&limit=50`, { token: token! }),
    enabled: Boolean(token && orgId),
    staleTime: 0,
  });
}

export function useNotificationCount(token: string | null, orgId: string | null) {
  return useQuery({
    queryKey: notificationKeys.count(orgId ?? ""),
    queryFn: () => apiJson<number>(`/notifications/count?orgId=${orgId!}`, { token: token! }),
    enabled: Boolean(token && orgId),
    staleTime: 30_000,
  });
}

export function useMarkNotificationsRead(token: string | null, orgId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch(`/notifications/read`, {
        token: token!,
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.list(orgId ?? "") });
      void queryClient.invalidateQueries({ queryKey: notificationKeys.count(orgId ?? "") });
    },
  });
}

export function useMarkAllNotificationsRead(token: string | null, orgId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch(`/notifications/read-all`, {
        token: token!,
        method: "POST",
        body: JSON.stringify({ orgId }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.list(orgId ?? "") });
      void queryClient.invalidateQueries({ queryKey: notificationKeys.count(orgId ?? "") });
    },
  });
}
