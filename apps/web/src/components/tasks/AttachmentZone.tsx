"use client";

import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { apiFetch, apiJson } from "@/lib/api";
import { POP_EASE, motionDuration } from "@/components/ui/motion-presets";
import { ConfirmDialog, type ConfirmDialogOptions } from "@/components/ui/ConfirmDialog";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { formatInTimeZone } from "@/lib/date";

type AttachmentRow = {
  id: string;
  taskId: string;
  uploadedBy: string;
  fileName: string;
  fileSize: string;
  mimeType: string;
  storageKey: string;
  url: string;
  discordDeliveredAt: string | null;
  createdAt: string;
};

function formatBytes(bytes: string | number): string {
  const n = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mime: string): string {
  if (mime.startsWith("image/")) return "🖼";
  if (mime === "application/pdf") return "📄";
  if (mime.startsWith("text/")) return "📝";
  return "📎";
}

type Props = {
  taskId: string;
  token: string;
  userId: string;
  viewOnly?: boolean;
};

export function AttachmentZone({ taskId, token, userId, viewOnly }: Props) {
  const { timeZone } = useWorkspaceRoute();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const prefersReduced = useReducedMotion();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmDialogOptions | null>(null);

  const query = useQuery({
    queryKey: ["attachments", taskId],
    queryFn: () => apiJson<AttachmentRow[]>(`/tasks/${taskId}/attachments`, { token }),
    staleTime: 30_000,
    enabled: Boolean(token && taskId),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/attachments/${id}`, { token, method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["attachments", taskId] }),
  });

  const uploadFile = useCallback(
    async (file: File) => {
      setUploadError(null);
      setUploading(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await apiFetch(`/tasks/${taskId}/attachments/upload`, {
          token,
          method: "POST",
          body: form,
          signal: AbortSignal.timeout(120_000),
        });
        if (res.status === 401 && typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("wl:auth-expired"));
        }
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || res.statusText);
        }
        void queryClient.invalidateQueries({ queryKey: ["attachments", taskId] });
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [taskId, token, queryClient],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      void uploadFile(files[0]!);
    },
    [uploadFile],
  );

  if (viewOnly && (!query.data || query.data.length === 0)) return null;

  return (
    <div className="space-y-2">
      <ConfirmDialog open={confirm != null} options={confirm} onClose={() => setConfirm(null)} />
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Attachments</h3>
        {!viewOnly && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            aria-label="Upload attachment"
            title="Upload attachment"
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
          >
            <FontAwesomeIcon icon={faPlus} className="size-3.5" />
          </button>
        )}
      </div>

      {!viewOnly && (
        <>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept="image/*,application/pdf,text/*,.doc,.docx,.xls,.xlsx"
            onChange={(e) => handleFiles(e.target.files)}
          />
          {uploading && <p className="text-xs text-[var(--muted)]">Uploading…</p>}
          {uploadError && <p className="text-xs text-red-600 dark:text-red-400">{uploadError}</p>}
        </>
      )}

      {query.data && query.data.length > 0 && (
        <ul className="space-y-1">
          <AnimatePresence initial={false}>
            {query.data.map((a) => (
              <motion.li
                key={a.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: motionDuration(0.18, prefersReduced), ease: POP_EASE }}
                className="flex items-center gap-2 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2"
              >
                <span className="text-base" aria-hidden>{fileIcon(a.mimeType)}</span>
                <div className="min-w-0 flex-1">
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-sm font-medium text-[var(--fg)] hover:underline"
                  >
                    {a.fileName}
                  </a>
                  <p className="font-mono-ledger text-[10px] text-[var(--muted)]">{formatBytes(a.fileSize)}</p>
                </div>
                {a.discordDeliveredAt && (
                  <span
                    title={`Sent to Discord ${formatInTimeZone(new Date(a.discordDeliveredAt), timeZone, { dateStyle: "medium", timeStyle: "short" })}`}
                    className="shrink-0 rounded-full bg-[#5865F2]/15 px-2 py-0.5 text-[10px] font-semibold text-[#5865F2] dark:bg-[#5865F2]/25"
                  >
                    Discord
                  </span>
                )}
                {!viewOnly && (a.uploadedBy === userId) && (
                  <button
                    type="button"
                    onClick={() =>
                      setConfirm({
                        title: "Delete this attachment?",
                        description: `This will permanently remove "${a.fileName}". This cannot be undone.`,
                        confirmLabel: "Delete",
                        variant: "danger",
                        onConfirm: () => deleteMutation.mutate(a.id),
                      })
                    }
                    disabled={deleteMutation.isPending}
                    aria-label="Delete attachment"
                    className="shrink-0 rounded-md p-1 text-[var(--muted)] hover:text-red-500 hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" className="size-3.5" aria-hidden>
                      <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                      <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                    </svg>
                  </button>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
