"use client";

import Link from "next/link";
import { Outfit } from "next/font/google";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDiscord, faGoogle } from "@fortawesome/free-brands-svg-icons";
import { faEnvelope } from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { LogBaseMark } from "@/components/brand/LogBaseMark";
import { authClient } from "@/lib/auth-client";
import { useBoot } from "@/components/app/BootProvider";

const brand = Outfit({
  subsets: ["latin"],
  weight: ["600", "700"],
});

type Step = "hub" | "connecting" | "email";
type OAuthProvider = "discord" | "google";
type HubOption = { kind: "provider"; provider: OAuthProvider } | { kind: "email" };

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

function IconArrowLeft({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  );
}

const PROVIDER_META: Record<
  OAuthProvider,
  { label: string; icon: IconDefinition; iconClassName: string; tintClassName: string; ringClassName: string }
> = {
  discord: {
    label: "Discord",
    icon: faDiscord,
    iconClassName: "text-[#5865F2]",
    tintClassName: "border-[#5865F2]/30 bg-[#5865F2]/[0.08] hover:bg-[#5865F2]/[0.14]",
    ringClassName: "auth-combo-badge--discord",
  },
  google: {
    label: "Google",
    icon: faGoogle,
    iconClassName: "text-[#4285F4]",
    tintClassName: "border-[#4285F4]/30 bg-[#4285F4]/[0.08] hover:bg-[#4285F4]/[0.14]",
    ringClassName: "auth-combo-badge--google",
  },
};

const EMAIL_OPTION_META = {
  label: "Email",
  icon: faEnvelope,
  iconClassName: "text-[var(--accent)]",
  tintClassName: "border-[var(--border-subtle)] bg-[var(--surface-base)] hover:bg-[var(--surface-hover)]",
};

const HUB_OPTIONS: HubOption[] = [
  { kind: "provider", provider: "discord" },
  { kind: "provider", provider: "google" },
  { kind: "email" },
];

function hubOptionMeta(option: HubOption) {
  return option.kind === "provider" ? PROVIDER_META[option.provider] : EMAIL_OPTION_META;
}

function hubOptionKey(option: HubOption) {
  return option.kind === "provider" ? option.provider : "email";
}

/** Big icon + wordmark lockup — also the home link, since the hub/connecting screens drop the separate "back to home" link. */
function BigLogo({ size }: { size: number }) {
  return (
    <Link
      href="/"
      className="flex shrink-0 items-center gap-4 rounded-lg outline-offset-4 transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
    >
      <LogBaseMark size={size} decorative />
      <span className={`${brand.className} text-4xl font-bold tracking-[-0.03em] text-[var(--fg)] sm:text-5xl`}>
        LogBase
      </span>
    </Link>
  );
}

function HubOptionRow({ option, onSelect }: { option: HubOption; onSelect: (option: HubOption) => void }) {
  const meta = hubOptionMeta(option);
  return (
    <button
      type="button"
      onClick={() => onSelect(option)}
      className={`flex h-16 w-72 items-center gap-4 rounded-2xl border pl-5 pr-6 text-left text-base font-medium text-[var(--fg)] transition-colors ${meta.tintClassName}`}
    >
      <FontAwesomeIcon icon={meta.icon} className={`size-6 shrink-0 ${meta.iconClassName}`} />
      Continue with {meta.label}
    </button>
  );
}

/** Mobile fallback: plain stacked full-width buttons, no wiring diagram. */
function HubOptionButtonCompact({ option, onSelect }: { option: HubOption; onSelect: (option: HubOption) => void }) {
  const meta = hubOptionMeta(option);
  return (
    <button
      type="button"
      onClick={() => onSelect(option)}
      className={`flex h-14 w-full items-center justify-center gap-3 rounded-xl border text-base font-medium text-[var(--fg)] transition-colors ${meta.tintClassName}`}
    >
      <FontAwesomeIcon icon={meta.icon} className={`size-5 ${meta.iconClassName}`} />
      Continue with {meta.label}
    </button>
  );
}

/** Step 1: big logo, a big "@" glyph, and the three option pills. */
function HubStep({ error, onSelect }: { error: string | null; onSelect: (option: HubOption) => void }) {
  return (
    <div className="auth-combo-enter flex w-full flex-col items-center gap-10">
      {/* md+: logo, "@", option pills — side by side */}
      <div className="hidden w-full items-center justify-center gap-10 md:flex">
        <BigLogo size={104} />
        <span className={`${brand.className} select-none text-6xl font-bold text-[var(--muted)]`} aria-hidden>
          @
        </span>
        <div className="flex flex-col gap-6">
          {HUB_OPTIONS.map((option) => (
            <HubOptionRow key={hubOptionKey(option)} option={option} onSelect={onSelect} />
          ))}
        </div>
      </div>

      {/* below md: logo on top, "@", options stacked underneath */}
      <div className="flex w-full flex-col items-center gap-6 md:hidden">
        <BigLogo size={72} />
        <span className={`${brand.className} select-none text-5xl font-bold text-[var(--muted)]`} aria-hidden>
          @
        </span>
        <div className="flex w-full flex-col gap-3.5">
          {HUB_OPTIONS.map((option) => (
            <HubOptionButtonCompact key={hubOptionKey(option)} option={option} onSelect={onSelect} />
          ))}
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="w-full max-w-sm rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm leading-relaxed text-red-800 dark:text-red-200"
        >
          {error}
        </p>
      )}
    </div>
  );
}

/** Step 2: no card, no text — just the two logos, same size, and a three-dot loading indicator between them. */
function ConnectingStep({ provider }: { provider: OAuthProvider }) {
  const meta = PROVIDER_META[provider];
  return (
    <div className="auth-combo-enter flex w-full flex-col items-center justify-center gap-8 py-6 md:flex-row md:gap-16">
      {/*
        Choreographed sequence, not independent loops: all five elements share the same 3.5s
        keyframe (a single blink in the first 20% of the timeline, then rest) with delays spaced
        0.7s apart in order — logo, dot, dot, dot, logo — so exactly one is blinking at a time and
        the round-robin repeats seamlessly forever. `animation-fill-mode: backwards` (in the CSS)
        is what keeps the delayed ones dim until their turn, instead of lit from first paint.
      */}
      <Link
        href="/"
        className="auth-combo-seq-ring flex size-28 items-center justify-center rounded-full outline-offset-4 transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] sm:size-32"
      >
        <LogBaseMark size={84} decorative />
      </Link>

      <span className="flex shrink-0 items-center gap-3 sm:gap-4" aria-hidden>
        <span className="auth-combo-seq-dot size-4 sm:size-5" style={{ animationDelay: "0.7s" }} />
        <span className="auth-combo-seq-dot size-4 sm:size-5" style={{ animationDelay: "1.4s" }} />
        <span className="auth-combo-seq-dot size-4 sm:size-5" style={{ animationDelay: "2.1s" }} />
      </span>

      <span
        className={`auth-combo-seq-ring ${meta.ringClassName} flex size-28 items-center justify-center rounded-full sm:size-32`}
        style={{ animationDelay: "2.8s" }}
      >
        {/* Inline style, not a `size-*` class — guarantees an exact pixel match with LogBaseMark's
            `size={84}` regardless of CSS cascade order (see fontawesome-config.ts for the class it fought before). */}
        <FontAwesomeIcon icon={meta.icon} className={meta.iconClassName} style={{ width: 84, height: 84 }} />
      </span>
    </div>
  );
}

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();

  const formId = useId();
  const emailId = `${formId}-email`;
  const passwordId = `${formId}-password`;
  const nameId = `${formId}-name`;

  const [step, setStep] = useState<Step>("hub");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  /** Maps to Better Auth `rememberMe` (persistent cookie + longer DB session when true). */
  const [staySignedIn, setStaySignedIn] = useState(true);
  /** Set once a provider is chosen on the hub, until the browser hands off to that provider's OAuth screen. */
  const [connectingProvider, setConnectingProvider] = useState<OAuthProvider | null>(null);
  const { activate, deactivate } = useBoot();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    activate();
    try {
      if (mode === "signup") {
        // Server accepts `rememberMe`; inferred client types for `signUp.email` omit it in some releases.
        const { error: err } = await authClient.signUp.email({
          email,
          password,
          name: name || email.split("@")[0] || "User",
          ...(staySignedIn ? {} : { rememberMe: false }),
        } as Parameters<typeof authClient.signUp.email>[0]);
        if (err) { deactivate(); setError(err.message ?? "Sign up failed"); }
        else router.replace(next);
      } else {
        const { error: err } = await authClient.signIn.email({
          email,
          password,
          rememberMe: staySignedIn,
        });
        if (err) { deactivate(); setError(err.message ?? "Sign in failed"); }
        else router.replace(next);
      }
    } catch {
      deactivate();
    } finally {
      setLoading(false);
    }
  }

  async function onProviderSignIn(provider: OAuthProvider) {
    setError(null);
    setConnectingProvider(provider);
    setStep("connecting");
    try {
      // On success this call itself navigates the browser to the provider's authorize screen —
      // it does not throw on a failed request, so `error` must be checked explicitly or a bad
      // provider config just leaves the connecting screen stuck forever with no visible failure.
      const { error: err } = await authClient.signIn.social({ provider, callbackURL: next });
      if (err) {
        setConnectingProvider(null);
        setStep("hub");
        setError(err.message ?? `${PROVIDER_META[provider].label} sign-in failed`);
      }
    } catch {
      setConnectingProvider(null);
      setStep("hub");
    }
  }

  function onSelectHubOption(option: HubOption) {
    if (option.kind === "email") {
      setError(null);
      setStep("email");
    } else {
      onProviderSignIn(option.provider);
    }
  }

  function goBackToHub() {
    setError(null);
    setStep("hub");
  }

  function flipMode() {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
    setError(null);
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[var(--surface-base)] px-4 py-10 text-[var(--fg)] sm:px-6">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          background:
            "radial-gradient(ellipse 75% 55% at 50% -20%, var(--accent-glow), transparent), radial-gradient(ellipse 55% 45% at 100% 0%, var(--accent-glow-soft), transparent)",
        }}
        aria-hidden
      />

      <div className="relative z-[1] flex flex-1 flex-col items-center justify-center">
        <div
          className={`flex w-full flex-col items-center ${
            step === "email" ? "max-w-[22rem] sm:max-w-[24rem]" : "max-w-3xl"
          }`}
        >
          {step === "hub" && <HubStep error={error} onSelect={onSelectHubOption} />}

          {step === "connecting" && connectingProvider && <ConnectingStep provider={connectingProvider} />}

          {step === "email" && (
          <div className="ui-auth-card-enter surface-elevated mt-6 w-full rounded-xl border border-[var(--border-subtle)] px-6 py-7 shadow-[0_24px_64px_-28px_color-mix(in_srgb,var(--fg)_14%,transparent)] sm:px-7 sm:py-8">
            <button
              type="button"
              onClick={goBackToHub}
              className="mb-5 inline-flex items-center gap-1.5 rounded-lg text-sm text-[var(--muted)] outline-offset-4 transition-colors hover:text-[var(--fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
            >
              <IconArrowLeft className="size-3.5" />
              Back
            </button>

            <div className="flex flex-col items-center text-center">
              <p className="text-pretty text-sm leading-relaxed text-[var(--muted)]">Continue to your</p>
              <Link
                href="/"
                className={`mt-2 inline-flex items-center gap-2.5 rounded-lg outline-offset-4 transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${brand.className}`}
              >
                <LogBaseMark variant="auth" decorative />
                <span className="text-2xl font-bold tracking-[-0.03em] text-[var(--fg)]">LogBase</span>
              </Link>
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

              <div className="flex items-center gap-2.5">
                <input
                  id={`${formId}-stay-signed-in`}
                  type="checkbox"
                  className="size-4 shrink-0 rounded border border-[var(--border)] accent-[var(--accent)]"
                  checked={staySignedIn}
                  onChange={(e) => setStaySignedIn(e.target.checked)}
                  disabled={loading}
                />
                <label htmlFor={`${formId}-stay-signed-in`} className="text-left text-sm leading-snug text-[var(--muted)]">
                  Remember me?
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
                aria-label={mode === "signin" ? "Sign in to LogBase with email and password" : "Create your LogBase account"}
              >
                {mode === "signin" ? "Log in" : "Create Account"}
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
          )}
        </div>
      </div>

      <div className="relative z-[1] flex flex-col items-center pt-6">
        <p className="font-mono-ledger text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
          LogBase · Organize · Track · Execute
        </p>
      </div>
    </div>
  );
}
