"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircleNotch } from "@phosphor-icons/react";

export type ConfirmDialogOptions = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Primary button uses danger styling (e.g. delete). */
  variant?: "danger" | "default";
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  open,
  options,
  onClose,
}: {
  open: boolean;
  options: ConfirmDialogOptions | null;
  onClose: () => void;
}) {
  const titleId = useId();
  const descId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
    else setPending(false);
  }, [open]);

  if (!open || !options || typeof document === "undefined") return null;

  const o = options;
  const danger = o.variant !== "default";
  const cancelLabel = o.cancelLabel ?? "Cancel";

  async function confirm() {
    if (pending) return;
    const result = o.onConfirm();
    if (result && typeof (result as Promise<void>).then === "function") {
      setPending(true);
      try {
        await result;
        onClose();
      } catch {
        /* caller surfaces errors; keep dialog open */
      } finally {
        setPending(false);
      }
      return;
    }
    onClose();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        aria-hidden
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative z-[1] w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-6 shadow-xl shadow-black/20"
      >
        <h2 id={titleId} className="text-lg font-semibold tracking-tight text-[var(--fg)]">
          {o.title}
        </h2>
        <p id={descId} className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          {o.description}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="btn-secondary rounded-xl px-4 py-2 text-sm font-medium"
            onClick={onClose}
            disabled={pending}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            disabled={pending}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-elevated)] disabled:opacity-70 ${
              danger
                ? "bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500"
                : "bg-[var(--accent)] hover:opacity-95"
            }`}
            onClick={() => void confirm()}
          >
            {pending ? (
              <CircleNotch weight="bold" className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
            ) : null}
            {pending ? "Working…" : o.confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
