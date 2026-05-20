"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { TaskEditor } from "@/components/tasks/TaskEditor";

function TaskPageInner() {
  const params = useParams();
  const taskId = params.taskId as string;
  return <TaskEditor taskId={taskId} />;
}

export default function TaskPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[var(--muted)]">Loading…</div>}>
      <TaskPageInner />
    </Suspense>
  );
}
