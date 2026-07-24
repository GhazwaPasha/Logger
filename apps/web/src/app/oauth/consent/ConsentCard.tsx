"use client";

import { useState } from "react";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { InlineSpinner } from "@/components/ui/InlineSpinner";

type Props = {
  consentCode: string;
  clientName: string;
  clientIcon: string | null;
  scopes: string[];
  userEmail: string;
};

export function ConsentCard({ consentCode, clientName, clientIcon, scopes, userEmail }: Props) {
  const [busy, setBusy] = useState<"allow" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function respond(accept: boolean) {
    if (busy) return;
    setBusy(accept ? "allow" : "deny");
    setError(null);
    try {
      const res = await fetch("/api/auth/oauth2/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accept, consent_code: consentCode }),
      });
      const data = (await res.json().catch(() => null)) as { redirectURI?: string } | null;
      if (!res.ok || !data?.redirectURI) {
        throw new Error("Could not complete the connection. Please try again.");
      }
      window.location.href = data.redirectURI;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete the connection.");
      setBusy(null);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--surface-base)] px-4">
      <div className="surface-elevated w-full max-w-md rounded-2xl border border-[var(--border-subtle)] p-8">
        <div className="flex items-center justify-center gap-4">
          {clientIcon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={clientIcon} alt="" className="size-12 rounded-xl border border-[var(--border-subtle)]" />
          ) : (
            <div className="flex size-12 items-center justify-center rounded-xl bg-[var(--accent-muted)] text-lg font-semibold text-[var(--accent)]">
              {clientName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <h1 className="mt-4 text-center text-lg font-semibold tracking-tight">
          {clientName} wants to access your account
        </h1>
        <p className="mt-1.5 text-center text-sm text-[var(--muted)]">Signed in as {userEmail}</p>

        {scopes.length > 0 && (
          <ul className="mt-6 space-y-2 text-sm text-[var(--fg)]">
            {scopes.map((scope) => (
              <li key={scope} className="flex items-center gap-2">
                <span className="size-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                <span>{scope}</span>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <div className="mt-4">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
          </div>
        )}

        <div className="mt-8 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            className="btn-primary inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium"
            disabled={busy !== null}
            aria-busy={busy === "allow" || undefined}
            onClick={() => void respond(true)}
          >
            {busy === "allow" ? <InlineSpinner className="size-4 shrink-0 animate-spin motion-reduce:animate-none" /> : null}
            <span>Allow</span>
          </button>
          <button
            type="button"
            className="btn-secondary inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium"
            disabled={busy !== null}
            aria-busy={busy === "deny" || undefined}
            onClick={() => void respond(false)}
          >
            {busy === "deny" ? <InlineSpinner className="size-4 shrink-0 animate-spin motion-reduce:animate-none" /> : null}
            <span>Deny</span>
          </button>
        </div>
      </div>
    </main>
  );
}
