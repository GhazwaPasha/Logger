"use client";

import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

type DiscordSubmitResponse = {
  id: string;
  fileName: string;
  discord: { ok: true } | { ok: false; reason: string };
};

type Props = {
  taskId: string;
  token: string;
};

/**
 * Separate upload control from the plain Attachments box — files sent here are also posted to the
 * task's Discord channel, synchronously, so success/failure is shown immediately rather than silently
 * failing in the background. The uploaded file still shows up in the shared Attachments list below.
 */
export function DiscordSubmissionZone({ taskId, token }: Props) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const submitFile = useCallback(
    async (file: File) => {
      setResult(null);
      setSubmitting(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await apiFetch(`/tasks/${taskId}/attachments/discord-submit`, {
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
        const body = (await res.json()) as DiscordSubmitResponse;
        void queryClient.invalidateQueries({ queryKey: ["attachments", taskId] });
        if (body.discord.ok) {
          setResult({ ok: true, message: `Sent "${body.fileName}" to Discord` });
        } else {
          setResult({ ok: false, message: `Attached, but Discord rejected it: ${body.discord.reason}` });
        }
      } catch (e) {
        setResult({ ok: false, message: e instanceof Error ? e.message : "Submission failed" });
      } finally {
        setSubmitting(false);
      }
    },
    [taskId, token, queryClient],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      void submitFile(files[0]!);
    },
    [submitFile],
  );

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Discord submission</h3>
      <div
        role="button"
        tabIndex={0}
        aria-label="Submit file to Discord"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors ${dragOver ? "border-[var(--accent)] bg-[var(--accent-muted)]/20" : "border-[var(--border-subtle)] hover:border-[var(--accent)]/50"}`}
      >
        <svg viewBox="0 0 127.14 96.36" fill="currentColor" className="size-6 text-[var(--muted)]" aria-hidden>
          <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
        </svg>
        <p className="text-xs text-[var(--muted)]">
          {submitting ? "Sending to Discord…" : "Drop a file here or click to submit to Discord"}
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
      {result && (
        <p className={`text-xs ${result.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
