"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useOpenNewTask } from "@/hooks/useOpenNewTask";

function NewTaskRedirect() {
  const searchParams = useSearchParams();
  const listId = searchParams.get("listId") ?? undefined;
  const { openNewTask } = useOpenNewTask();

  useEffect(() => {
    void openNewTask(listId);
  }, [openNewTask, listId]);

  return <div className="p-8 text-sm text-[var(--muted)]">Opening new task…</div>;
}

export default function NewTaskPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[var(--muted)]">Loading…</div>}>
      <NewTaskRedirect />
    </Suspense>
  );
}
