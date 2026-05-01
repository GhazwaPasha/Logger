"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { LogBaseMark } from "@/components/brand/LogBaseMark";
import { authClient } from "@/lib/auth-client";
import { safeReturnPath } from "@/lib/safe-return-path";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeReturnPath(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error: err } = await authClient.signUp.email({
          email,
          password,
          name: name || email.split("@")[0] || "User",
        });
        if (err) setError(err.message ?? "Sign up failed");
        else router.push(next);
      } else {
        const { error: err } = await authClient.signIn.email({ email, password });
        if (err) setError(err.message ?? "Sign in failed");
        else router.push(next);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card surface-elevated">
        <div className="mb-8 space-y-4">
          <div className="flex items-center gap-2.5">
            <LogBaseMark variant="auth" decorative />
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              LogBase
            </p>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--fg)]">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm text-[var(--muted)]">
            {mode === "signin" ? "Sign in to open your workspace." : "Use a work email you can verify later."}
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]" htmlFor="name">
                Name
              </label>
              <input
                id="name"
                className="input rounded-xl"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className="input rounded-xl"
              type="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="input rounded-xl"
              type="password"
              required
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200">
              {error}
            </p>
          )}
          <button className="btn-primary h-11 w-full rounded-xl text-sm font-medium" type="submit" disabled={loading}>
            {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button
          type="button"
          className="mt-6 w-full text-center text-sm text-[var(--accent)] underline-offset-4 hover:underline"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
          }}
        >
          {mode === "signin" ? "Need an account? Sign up" : "Already registered? Sign in"}
        </button>
        <Link href="/" className="mt-8 block text-center text-sm text-[var(--muted)] hover:text-[var(--fg)]">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
