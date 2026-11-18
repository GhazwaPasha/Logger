"use client";

import Link from "next/link";
import { Outfit } from "next/font/google";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, CircleAlert, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, UserRound, type LucideIcon } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDiscord, faGoogle } from "@fortawesome/free-brands-svg-icons";
import { faEnvelope } from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { LogBaseMark } from "@/components/brand/LogBaseMark";
import { authClient } from "@/lib/auth-client";
import { useBoot } from "@/components/app/BootProvider";
import { Toggle } from "@/components/ui/Toggle";
import { curve } from "@/lib/motion";
import { CollapseItem } from "@/components/ui/Collapse";

const brand = Outfit({
  subsets: ["latin"],
  weight: ["600", "700"],
});

type Step = "hub" | "connecting" | "email";
type OAuthProvider = "discord" | "google";
type HubOption = { kind: "provider"; provider: OAuthProvider } | { kind: "email" };

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

const FIELD =
  "input h-12 rounded-xl pl-11 text-[15px] disabled:opacity-60";

function Field({
  id,
  label,
  icon: Icon,
  trailing,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  icon: LucideIcon;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="pl-1 text-left text-[13px] font-medium text-[var(--muted)]">
        {label}
      </label>
      <div className="relative">
        <Icon aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-[var(--ink-3)]" strokeWidth={2} />
        <input id={id} className={`${FIELD} ${trailing ? "pr-12" : ""}`} {...input} />
        {trailing}
      </div>
    </div>
  );
}

/**
 * Email sign-in / sign-up card. A sliding segmented control picks the mode (the name field grows
 * in and out with it), fields carry leading icons, "Stay signed in" is a switch, and the submit
 * button shows its own working state.
 */
function EmailCard({
  mode,
  setMode,
  ids,
  values,
  setName,
  setEmail,
  setPassword,
  showPassword,
  setShowPassword,
  staySignedIn,
  setStaySignedIn,
  loading,
  error,
  onSubmit,
  onBack,
}: {
  mode: "signin" | "signup";
  setMode: (m: "signin" | "signup") => void;
  ids: { nameId: string; emailId: string; passwordId: string; rememberId: string };
  values: { name: string; email: string; password: string };
  setName: (v: string) => void;
  setEmail: (v: string) => void;
  setPassword: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (fn: (v: boolean) => boolean) => void;
  staySignedIn: boolean;
  setStaySignedIn: (v: boolean) => void;
  loading: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
}) {
  const reduce = useReducedMotion();
  const signup = mode === "signup";
  return (
    <div className="ui-auth-card-enter mt-6 w-full rounded-[24px] bg-[var(--card)] p-7 shadow-raised sm:p-8">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="pressable -ml-2 inline-flex h-8 items-center gap-1 rounded-lg px-2 text-sm font-medium text-[var(--muted)] hover:bg-[var(--fill)] hover:text-[var(--fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </button>
        <Link href="/" className="rounded-lg opacity-90 transition-opacity hover:opacity-100" aria-label="LogBase home">
          <LogBaseMark variant="auth" decorative />
        </Link>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={mode}
          initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(6px)" }}
          animate={{ opacity: 1, transform: "translateY(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(-6px)" }}
          transition={{ duration: 0.18, ease: curve.respond }}
          className="mt-5"
        >
          <h1 className={`text-[28px] font-bold leading-tight tracking-[-0.03em] text-[var(--fg)] ${brand.className}`}>
            {signup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--muted)]">
            {signup ? "Start keeping every task on the record." : "Log in to LogBase with your email."}
          </p>
        </motion.div>
      </AnimatePresence>

      <div className="mt-6 grid grid-cols-2 rounded-[13px] bg-[var(--fill-2)] p-[3px]" role="tablist" aria-label="Log in or create an account">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            disabled={loading}
            className={`relative h-9 rounded-[10px] text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
              mode === m ? "text-[var(--fg)]" : "text-[var(--muted)] hover:text-[var(--fg)]"
            }`}
          >
            {mode === m && (
              <motion.span
                layoutId="auth-mode-thumb"
                className="absolute inset-0 rounded-[10px] bg-[var(--card)] shadow-card"
                transition={reduce ? { duration: 0 } : { type: "spring", duration: 0.36, bounce: 0 }}
              />
            )}
            <span className="relative">{m === "signin" ? "Log in" : "Create account"}</span>
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <AnimatePresence initial={false}>
          {signup && (
            <CollapseItem key="name" boxClassName="-mb-4" className="pb-4">
              <Field
                id={ids.nameId}
                label="Name"
                icon={UserRound}
                placeholder="How LogBase should greet you"
                value={values.name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                autoComplete="name"
              />
            </CollapseItem>
          )}
        </AnimatePresence>

        <Field
          id={ids.emailId}
          label="Email"
          icon={Mail}
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
          value={values.email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />

        <Field
          id={ids.passwordId}
          label="Password"
          icon={LockKeyhole}
          type={showPassword ? "text" : "password"}
          required
          autoComplete={signup ? "new-password" : "current-password"}
          placeholder={signup ? "At least 8 characters" : "Your password"}
          value={values.password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          trailing={
            <button
              type="button"
              className="pressable absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--fill-2)] hover:text-[var(--fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              onClick={() => setShowPassword((v) => !v)}
              aria-pressed={showPassword}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
            </button>
          }
        />

        <div className="flex items-center justify-between gap-3 px-1">
          <label htmlFor={ids.rememberId} className="text-left text-sm text-[var(--muted)]">
            Stay signed in
          </label>
          <span id={ids.rememberId}>
            <Toggle checked={staySignedIn} onChange={setStaySignedIn} disabled={loading} aria-label="Stay signed in" />
          </span>
        </div>

        <AnimatePresence initial={false}>
          {error && (
            <motion.p
              key="error"
              role="alert"
              initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(-4px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: curve.respond }}
              className="flex items-start gap-2.5 rounded-xl bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-3.5 py-3 text-sm leading-relaxed text-[var(--danger)]"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </motion.p>
          )}
        </AnimatePresence>

        <button
          className="pressable mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] text-[15px] font-semibold text-[var(--on-primary)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)] disabled:opacity-70"
          type="submit"
          disabled={loading}
          aria-label={signup ? "Create your LogBase account" : "Log in to LogBase with email and password"}
        >
          {loading ? <LoaderCircle className="size-[18px] animate-spin motion-reduce:animate-none" aria-hidden /> : null}
          {loading ? (signup ? "Creating account…" : "Logging in…") : signup ? "Create account" : "Log in"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs leading-relaxed text-[var(--muted)]">
        By continuing you agree to the{" "}
        <Link href="/terms" className="font-medium text-[var(--fg)] underline-offset-2 hover:underline">Terms</Link> and{" "}
        <Link href="/privacy" className="font-medium text-[var(--fg)] underline-offset-2 hover:underline">Privacy Policy</Link>.
      </p>
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
            step === "email" ? "max-w-[26rem]" : "max-w-3xl"
          }`}
        >
          {step === "hub" && <HubStep error={error} onSelect={onSelectHubOption} />}

          {step === "connecting" && connectingProvider && <ConnectingStep provider={connectingProvider} />}

          {step === "email" && (
            <EmailCard
              mode={mode}
              setMode={(m) => {
                setMode(m);
                setError(null);
              }}
              ids={{ nameId, emailId, passwordId, rememberId: `${formId}-stay-signed-in` }}
              values={{ name, email, password }}
              setName={setName}
              setEmail={setEmail}
              setPassword={setPassword}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              staySignedIn={staySignedIn}
              setStaySignedIn={setStaySignedIn}
              loading={loading}
              error={error}
              onSubmit={onSubmit}
              onBack={goBackToHub}
            />
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
