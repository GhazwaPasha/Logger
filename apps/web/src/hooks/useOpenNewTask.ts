"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useApiSession } from "@/hooks/useApiSession";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { createDraftTask } from "@/lib/create-draft-task";

/**
 * Creates a draft task on the server, then navigates to its editor.
 * Avoids showing "Saving" on the create form while mint runs.
 */
export function useOpenNewTask() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token } = useApiSession();
  const { workspaceId, workspaceSlug } = useWorkspaceRoute();
  const { lists } = useWorkspaceData();
  const [isOpening, setIsOpening] = useState(false);
  const openingRef = useRef(false);

  const openNewTask = useCallback(
    async (listId?: string) => {
      if (!token || openingRef.current) return;
      const resolvedListId = listId ?? lists[0]?.id;
      if (!resolvedListId) return;

      openingRef.current = true;
      setIsOpening(true);
      try {
        const created = await createDraftTask(queryClient, workspaceId, token, {
          listId: resolvedListId,
        });
        router.push(`/${workspaceSlug}/work/task/${created.task.id}`);
      } finally {
        openingRef.current = false;
        setIsOpening(false);
      }
    },
    [token, lists, queryClient, workspaceId, router, workspaceSlug],
  );

  return { openNewTask, isOpening };
}
