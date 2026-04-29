import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-shell">
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
