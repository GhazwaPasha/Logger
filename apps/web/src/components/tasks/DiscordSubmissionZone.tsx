"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCloudArrowUp, faCheck, faCircleNotch, faCircleExclamation } from "@fortawesome/free-solid-svg-icons";
import { faDiscord } from "@fortawesome/free-brands-svg-icons";
import { apiFetch } from "@/lib/api";

type DiscordSubmitResponse = {
  id: string;
  fileName: string;
  discord: { ok: true } | { ok: false; reason: string };
};

/** Files sent to Discord in one go; also Discord's own per-message attachment cap. */
const MAX_FILES_PER_SUBMISSION = 5;

type QueueStatus = "pending" | "uploading" | "success" | "error";

type QueueItem = {
  id: string;
  file: File;
  status: QueueStatus;
  message?: string;
};

type Props = {
  taskId: string;
  token: string;
  /** Shows "(Required)*" inline with the label instead of a separate line. */
  required?: boolean;
  /** Name of the linked Discord channel; renders as a view-only chip when provided. */
  channelName?: string | null;
  /** Channel name is still being resolved — renders a skeleton chip instead of popping in late. */
  channelNameLoading?: boolean;
  /** Drops the card/header chrome — for mounting inside a surrounding Discord-themed card
   *  (the full editor's ToggleSection) that already provides them. Just the dropzone + result. */
  embedded?: boolean;
};

function makeQueueId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

/**
 * Separate upload control from the plain Attachments box — files sent here are also posted to the
 * task's Discord channel, synchronously, so success/failure is shown immediately rather than silently
 * failing in the background. The uploaded file still shows up in the shared Attachments list below.
 *
 * Submits up to `MAX_FILES_PER_SUBMISSION` files per batch, one at a time (each is its own Discord
 * message and API call), so a slow or failed upload doesn't block or hide the ones after it.
 */
export function DiscordSubmissionZone({
  taskId,
  token,
  required,
  channelName,
  channelNameLoading,
  embedded,
}: Props) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [overflowNotice, setOverflowNotice] = useState<string | null>(null);

  const submitting = queue.some((item) => item.status === "pending" || item.status === "uploading");

  const updateItem = useCallback((id: string, patch: Partial<QueueItem>) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  // Files can only be queued while nothing else is submitting (the dropzone disables input/drop/paste
  // in that state), so a freshly built batch is always processed start-to-finish with no interleaving.
  const processBatch = useCallback(
    async (items: QueueItem[]) => {
      for (const item of items) {
        updateItem(item.id, { status: "uploading" });
        try {
          const form = new FormData();
          form.append("file", item.file);
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
            updateItem(item.id, { status: "success", message: "Sent to Discord" });
          } else {
            updateItem(item.id, { status: "error", message: `Attached, but Discord rejected it: ${body.discord.reason}` });
          }
        } catch (e) {
          updateItem(item.id, { status: "error", message: e instanceof Error ? e.message : "Submission failed" });
        }
      }
    },
    [taskId, token, queryClient, updateItem],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0 || submitting) return;
      const picked = Array.from(files).slice(0, MAX_FILES_PER_SUBMISSION);
      setOverflowNotice(
        files.length > MAX_FILES_PER_SUBMISSION
          ? `Only the first ${MAX_FILES_PER_SUBMISSION} files were queued (max ${MAX_FILES_PER_SUBMISSION} at a time).`
          : null,
      );
      const items: QueueItem[] = picked.map((file) => ({ id: makeQueueId(), file, status: "pending" }));
      setQueue(items);
      void processBatch(items);
    },
    [submitting, processBatch],
  );

  const openBrowser = useCallback(() => {
    if (submitting) return;
    inputRef.current?.click();
  }, [submitting]);

  const onDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (submitting || !e.dataTransfer.types.includes("Files")) return;
      dragCounter.current += 1;
      setDragActive(true);
    },
    [submitting],
  );

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const onDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setDragActive(false);
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragCounter.current = 0;
      setDragActive(false);
      if (submitting) return;
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles, submitting],
  );

  // Paste-to-upload: only intercepts when the clipboard actually carries a file, so normal text
  // paste elsewhere on the page (comments, titles, etc.) is never affected.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const files = e.clipboardData?.files;
      if (!files || files.length === 0 || submitting) return;
      e.preventDefault();
      handleFiles(files);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleFiles, submitting]);

  const dropzone = (
    <div
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-3 py-5 text-center transition-colors ${
        submitting
          ? "border-[#5865F2]/20 opacity-60"
          : dragActive
            ? "border-[#5865F2] bg-[#5865F2]/10"
            : "border-[#5865F2]/30"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept="image/*,application/pdf,text/*,.doc,.docx,.xls,.xlsx"
        disabled={submitting}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={openBrowser}
        disabled={submitting}
        aria-label="Browse files"
        className="rounded-full text-[#5865F2] transition-colors hover:text-[#4752c4] disabled:cursor-default disabled:hover:text-[#5865F2]"
      >
        <FontAwesomeIcon
          icon={faCloudArrowUp}
          className={`size-5 ${submitting ? "animate-pulse motion-reduce:animate-none" : ""}`}
          aria-hidden
        />
      </button>
      <p className="text-xs font-medium text-[var(--fg)]">
        {submitting ? (
          "Sending to Discord…"
        ) : (
          <>
            Drag & drop or paste up to {MAX_FILES_PER_SUBMISSION} files, or{" "}
            <button
              type="button"
              onClick={openBrowser}
              className="font-semibold text-[#5865F2] underline underline-offset-2 hover:text-[#4752c4]"
            >
              browse
            </button>
          </>
        )}
      </p>
    </div>
  );

  const queueList = queue.length > 0 && (
    <ul className="space-y-1">
      {queue.map((item) => (
        <li key={item.id} className="flex items-center gap-2 text-xs">
          {item.status === "uploading" || item.status === "pending" ? (
            <FontAwesomeIcon
              icon={faCircleNotch}
              className="size-3 shrink-0 animate-spin text-[#5865F2] motion-reduce:animate-none"
              aria-hidden
            />
          ) : item.status === "success" ? (
            <FontAwesomeIcon icon={faCheck} className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          ) : (
            <FontAwesomeIcon icon={faCircleExclamation} className="size-3 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
          )}
          <span className="min-w-0 flex-1 truncate font-medium text-[var(--fg)]" title={item.file.name}>
            {item.file.name}
          </span>
          <span
            className={`shrink-0 ${
              item.status === "error"
                ? "text-red-600 dark:text-red-400"
                : item.status === "success"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-[var(--muted)]"
            }`}
          >
            {item.status === "pending"
              ? "Queued…"
              : item.status === "uploading"
                ? "Sending…"
                : item.message}
          </span>
        </li>
      ))}
    </ul>
  );

  const overflowMessage = overflowNotice && <p className="text-xs text-[var(--muted)]">{overflowNotice}</p>;

  if (embedded) {
    return (
      <div className="space-y-3">
        {dropzone}
        {overflowMessage}
        {queueList}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-[#5865F2]/25 bg-[#5865F2]/[0.05] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#5865F2]/15 text-[#5865F2] dark:bg-[#5865F2]/25">
          <FontAwesomeIcon icon={faDiscord} className="size-5" aria-hidden />
        </span>
        <h3 className="text-sm font-semibold text-[var(--fg)]">
          Send to Discord
          {required && <span className="ml-1 text-xs font-medium text-[var(--muted)]">(Required)*</span>}
        </h3>
        {channelName ? (
          <span
            title={`Submits to #${channelName}`}
            className="inline-flex max-w-full shrink-0 items-center gap-1 rounded-full border border-[#5865F2]/25 bg-[#5865F2]/10 px-2.5 py-1 text-xs font-medium text-[#5865F2] dark:bg-[#5865F2]/20"
          >
            <span className="truncate">#{channelName}</span>
          </span>
        ) : (
          channelNameLoading && (
            <span
              aria-hidden
              className="inline-flex h-[1.375rem] w-24 shrink-0 animate-pulse rounded-full bg-[#5865F2]/10 dark:bg-[#5865F2]/15"
            />
          )
        )}
      </div>

      {dropzone}
      {overflowMessage}
      {queueList}
    </div>
  );
}
