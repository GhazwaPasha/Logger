"use client";

import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
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
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Discord submission</h3>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={submitting}
          aria-label="Submit file to Discord"
          title="Submit file to Discord"
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-[#5865F2]/30 text-[#5865F2] transition-colors hover:border-[#5865F2] hover:bg-[#5865F2]/10 disabled:opacity-50"
        >
          <FontAwesomeIcon icon={faPlus} className="size-3.5" />
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="image/*,application/pdf,text/*,.doc,.docx,.xls,.xlsx"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {submitting && <p className="text-xs text-[var(--muted)]">Sending to Discord…</p>}
      {result && (
        <p className={`text-xs ${result.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
