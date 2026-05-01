import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--surface-base)] px-4 py-10">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-[var(--surface-muted)]" aria-hidden />
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
