"use client";

import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiJson } from "@/lib/api";

type AttachmentRow = {
  id: string;
  taskId: string;
  uploadedBy: string;
  fileName: string;
  fileSize: string;
  mimeType: string;
  storageKey: string;
  url: string;
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
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

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
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Attachments</h3>

      {!viewOnly && (
        <>
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload file"
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors ${dragOver ? "border-[var(--accent)] bg-[var(--accent-muted)]/20" : "border-[var(--border-subtle)] hover:border-[var(--accent)]/50"}`}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-6 text-[var(--muted)]" aria-hidden>
              <path fillRule="evenodd" d="M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z" />
            </svg>
            <p className="text-xs text-[var(--muted)]">
              {uploading ? "Uploading…" : "Drop a file here or click to browse"}
            </p>
            <p className="text-[10px] text-[var(--muted)]">PDF, images, text, Office docs · max 10 MB</p>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept="image/*,application/pdf,text/*,.doc,.docx,.xls,.xlsx"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>
          {uploadError && <p className="text-xs text-red-600 dark:text-red-400">{uploadError}</p>}
        </>
      )}

      {query.data && query.data.length > 0 && (
        <ul className="space-y-1">
          {query.data.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2">
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
              {!viewOnly && (a.uploadedBy === userId) && (
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(a.id)}
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
