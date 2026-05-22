"use client";

import Link from "next/link";
import { Outfit } from "next/font/google";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { LogBaseMark } from "@/components/brand/LogBaseMark";
import { authClient } from "@/lib/auth-client";
import { safeReturnPath } from "@/lib/safe-return-path";

const brand = Outfit({
  subsets: ["latin"],
  weight: ["600", "700"],
});

function IconSpinner({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function IconEye({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeReturnPath(searchParams.get("next"));

  const formId = useId();
  const emailId = `${formId}-email`;
  const passwordId = `${formId}-password`;
  const nameId = `${formId}-name`;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  /** Maps to Better Auth `rememberMe` (persistent cookie + longer DB session when true). */
  const [staySignedIn, setStaySignedIn] = useState(true);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        // Server accepts `rememberMe`; inferred client types for `signUp.email` omit it in some releases.
        const { error: err } = await authClient.signUp.email({
          email,
          password,
          name: name || email.split("@")[0] || "User",
          ...(staySignedIn ? {} : { rememberMe: false }),
        } as Parameters<typeof authClient.signUp.email>[0]);
        if (err) setError(err.message ?? "Sign up failed");
        else router.replace(next);
      } else {
        const { error: err } = await authClient.signIn.email({
          email,
          password,
          rememberMe: staySignedIn,
        });
        if (err) setError(err.message ?? "Sign in failed");
        else router.replace(next);
      }
    } finally {
      setLoading(false);
    }
  }

  function flipMode() {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
    setError(null);
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[var(--surface-base)] px-4 py-10 text-[var(--fg)] sm:px-6">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          background:
            "radial-gradient(ellipse 75% 55% at 50% -20%, var(--accent-glow), transparent), radial-gradient(ellipse 55% 45% at 100% 0%, var(--accent-glow-soft), transparent)",
        }}
        aria-hidden
      />

      <div className="relative z-[1] flex w-full max-w-[22rem] flex-col items-center sm:max-w-[24rem]">
        <Link
          href="/"
          className={`mb-8 inline-flex items-center gap-2.5 rounded-lg outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${brand.className}`}
        >
          <LogBaseMark variant="marketing" decorative className="shrink-0" />
          <span className="text-xl font-bold tracking-[-0.04em] text-[var(--fg)]">LogBase</span>
        </Link>

        <div className="ui-auth-card-enter surface-elevated mt-6 w-full rounded-xl border border-[var(--border-subtle)] px-6 py-7 shadow-[0_24px_64px_-28px_color-mix(in_srgb,var(--fg)_14%,transparent)] sm:px-7 sm:py-8">
          <div className="text-center">
            <h1 className={`${brand.className} text-balance text-[1.65rem] font-bold leading-[1.15] tracking-[-0.03em] text-[var(--fg)] sm:text-[1.75rem]`}>
              {mode === "signin" ? (
                <>Log in</>
              ) : (
                <>Sign up</>
              )}
            </h1>
            {mode === "signin" ? (
              <p className="mt-3 text-pretty text-sm leading-relaxed text-[var(--muted)]">Continue to your base</p>
            ) : null}
          </div>

          <form onSubmit={onSubmit} className="mt-7 space-y-4">
            {mode === "signup" && (
              <div>
                <label className="mb-1.5 block text-left text-xs font-medium text-[var(--muted)]" htmlFor={nameId}>
                  Name
                </label>
                <input
                  id={nameId}
                  className="input rounded-xl"
                  placeholder="How your base will greet you"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  autoComplete="name"
                />
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-left text-xs font-medium text-[var(--muted)]" htmlFor={emailId}>
                Email
              </label>
              <input
                id={emailId}
                className="input rounded-xl"
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-left text-xs font-medium text-[var(--muted)]" htmlFor={passwordId}>
                Password
              </label>
              <div className="relative">
                <input
                  id={passwordId}
                  className="input rounded-xl pr-11"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <input
                id={`${formId}-stay-signed-in`}
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 rounded border border-[var(--border)] accent-[var(--accent)]"
                checked={staySignedIn}
                onChange={(e) => setStaySignedIn(e.target.checked)}
                disabled={loading}
              />
              <label htmlFor={`${formId}-stay-signed-in`} className="text-left text-sm leading-snug text-[var(--muted)]">
                Stay signed in on this device
                <span className="mt-0.5 block text-xs text-[var(--muted)]/90">
                  Uncheck to sign out when you close the browser.
                </span>
              </label>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm leading-relaxed text-red-800 dark:text-red-200"
              >
                {error}
              </p>
            )}

            <button
              className="btn-primary flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium"
              type="submit"
              disabled={loading}
              aria-busy={loading}
              aria-label={mode === "signin" ? "Sign in to LogBase with email and password" : "Create your LogBase account"}
            >
              {loading ? (
                <>
                  <IconSpinner className="h-4 w-4 animate-spin" />
                  <span>{mode === "signin" ? "Opening your base…" : "Building your base…"}</span>
                </>
              ) : mode === "signin" ? (
                "Log in"
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <button
            type="button"
            className="mt-6 w-full text-pretty text-center text-sm leading-relaxed text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
            onClick={flipMode}
          >
            {mode === "signin" ? (
              <span className={`font-semibold text-[var(--fg)] ${brand.className}`}>Create account?</span>
            ) : (
              <>
                Already have an account?{" "}
                <span className={`font-semibold text-[var(--fg)] ${brand.className}`}>Log in</span>
              </>
            )}
          </button>
        </div>

        <p className="mt-6 font-mono-ledger text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
          LogBase · Organize · Track · Execute
        </p>

        <Link href="/" className="mt-5 text-sm text-[var(--muted)] transition-colors hover:text-[var(--fg)]">
          ← Back to LogBase home
        </Link>
      </div>
    </div>
  );
}
