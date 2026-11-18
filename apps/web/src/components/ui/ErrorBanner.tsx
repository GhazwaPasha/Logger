"use client";

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div
      role="alert"
      className="surface-elevated flex items-start justify-between gap-4 rounded-xl border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-4 py-3 text-sm text-[var(--danger)] dark:text-[var(--danger)]"
    >
      <span>{message}</span>
      {onDismiss && (
        <button type="button" className="btn-ghost shrink-0 text-xs" onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </div>
  );
}
