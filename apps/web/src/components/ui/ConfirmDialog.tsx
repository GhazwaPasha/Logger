"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/primitives/dialog";
import { cn } from "@/lib/utils";

export type ConfirmDialogOptions = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Primary button uses danger styling (e.g. delete). */
  variant?: "danger" | "default";
  onConfirm: () => void | Promise<void>;
};

/**
 * Confirmation dialog on the animate-ui Dialog: spring-in from the center, dimmed backdrop,
 * focus trapped and returned to the trigger, Escape and outside-click close it.
 * Same props as before, so every caller keeps working.
 */
export function ConfirmDialog({
  open,
  options,
  onClose,
}: {
  open: boolean;
  options: ConfirmDialogOptions | null;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(false);
  // Callers clear `options` the same moment they close; keep the last ones so the exit
  // animation still shows the text instead of collapsing to an empty card.
  const [lastOptions, setLastOptions] = useState<ConfirmDialogOptions | null>(options);
  if (options && options !== lastOptions) setLastOptions(options);
  const shown = options ?? lastOptions;

  useEffect(() => {
    if (!open) setPending(false);
  }, [open]);

  async function confirm(o: ConfirmDialogOptions) {
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

  const danger = shown?.variant !== "default";

  return (
    <Dialog
      open={open && options != null}
      onOpenChange={(next) => {
        if (!next && !pending) onClose();
      }}
    >
      {shown ? (
        <DialogContent
          role="alertdialog"
          showCloseButton={false}
          overlayClassName="z-[140]"
          className="z-[140] max-w-[calc(100%-2rem)] gap-0 p-6 sm:max-w-md"
          onOpenAutoFocus={(e) => {
            // Land on the confirm button, like the old dialog did.
            e.preventDefault();
            (e.currentTarget as HTMLElement).querySelector<HTMLButtonElement>("[data-confirm]")?.focus();
          }}
        >
          <DialogTitle className="text-lg font-semibold leading-snug text-ink">
            {shown.title}
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-relaxed text-ink-2">
            {shown.description}
          </DialogDescription>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="pressable h-10 rounded-xl bg-fill-2 px-4 text-sm font-medium text-ink hover:bg-fill-3 disabled:opacity-60"
              onClick={onClose}
              disabled={pending}
            >
              {shown.cancelLabel ?? "Cancel"}
            </button>
            <button
              data-confirm
              type="button"
              disabled={pending}
              className={cn(
                "pressable inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card-raised)] disabled:opacity-70",
                danger ? "bg-danger text-white hover:opacity-90" : "bg-primary text-on-primary hover:opacity-90",
              )}
              onClick={() => void confirm(shown)}
            >
              {pending ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
              {pending ? "Working…" : shown.confirmLabel}
            </button>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
