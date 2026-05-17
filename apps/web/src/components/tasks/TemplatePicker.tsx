"use client";

import { useQuery } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/api";

type Template = {
  id: string;
  name: string;
  defaultTitle: string | null;
  defaultPriority: string | null;
  defaultDueRepeat: string | null;
  defaultListId: string | null;
  defaultSubtasks: { title: string }[];
};

type ApplyResult = {
  title: string;
  priority: string;
  dueRepeat: string | null;
  listId: string | null;
  subtasks: { title: string }[];
};

export function TemplatePicker({
  orgId,
  token,
  onApply,
  onClose,
}: {
  orgId: string;
  token: string;
  onApply: (result: ApplyResult) => void;
  onClose: () => void;
}) {
  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["templates", orgId],
    queryFn: async () => {
      const res = await fetch(`${getApiBaseUrl()}/organizations/${orgId}/templates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load templates");
      return res.json() as Promise<Template[]>;
    },
    staleTime: 60_000,
  });

  async function applyTemplate(id: string) {
    const res = await fetch(`${getApiBaseUrl()}/organizations/${orgId}/templates/${id}/apply`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const result = (await res.json()) as ApplyResult;
    onApply(result);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Use Template</h2>
          <button type="button" onClick={onClose} className="text-xs text-[var(--muted)]">
            Close
          </button>
        </div>
        {isLoading && <p className="text-xs text-[var(--muted)]">Loading…</p>}
        {!isLoading && templates.length === 0 && (
          <p className="text-xs text-[var(--muted)]">No templates saved yet.</p>
        )}
        <ul className="space-y-1">
          {templates.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => void applyTemplate(t.id)}
                className="flex w-full flex-col rounded-xl px-3 py-2 text-left hover:bg-[var(--surface-muted)]"
              >
                <span className="text-sm font-medium">{t.name}</span>
                <span className="text-[10px] text-[var(--muted)]">
                  {[
                    t.defaultPriority && `Priority: ${t.defaultPriority}`,
                    t.defaultDueRepeat && `Repeats: ${t.defaultDueRepeat}`,
                    t.defaultSubtasks?.length ? `${t.defaultSubtasks.length} subtasks` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
