"use client";

import { useCallback, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useApiSession } from "@/hooks/useApiSession";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { createDraftTask } from "@/lib/create-draft-task";

/**
 * Seeds cache with a stub task and navigates to its editor immediately.
 * The server POST fires in the background — no waiting required.
 * `isOpening` reflects the client-side navigation itself (route compile + mount),
 * which is what actually causes the visible delay — not the draft POST.
 */
export function useOpenNewTask() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token, session } = useApiSession();
  const { workspaceId, workspaceSlug } = useWorkspaceRoute();
  const { lists } = useWorkspaceData();
  const openingRef = useRef(false);
  const [isOpening, startNavigation] = useTransition();

  const openNewTask = useCallback(
    (listId?: string) => {
      if (!token || openingRef.current) return;
      const resolvedListId = listId ?? lists[0]?.id;
      if (!resolvedListId) return;

      openingRef.current = true;
      const clientId = createDraftTask(queryClient, workspaceId, token, {
        listId: resolvedListId,
        assignerId: session?.user?.id ?? undefined,
      });
      startNavigation(() => {
        router.push(`/${workspaceSlug}/work/task/${clientId}`);
      });
      openingRef.current = false;
    },
    [token, session, lists, queryClient, workspaceId, router, workspaceSlug],
  );

  return { openNewTask, isOpening };
}
