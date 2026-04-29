"use client";

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div
      role="alert"
      className="surface-elevated flex items-start justify-between gap-4 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-200"
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
