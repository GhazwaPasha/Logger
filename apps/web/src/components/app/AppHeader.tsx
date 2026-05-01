"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LogBaseMark } from "@/components/brand/LogBaseMark";
import { authClient } from "@/lib/auth-client";

function userInitials(name: string | null | undefined, email: string | null | undefined) {
  const n = name?.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = parts[0]?.[0];
      const b = parts[parts.length - 1]?.[0];
      if (a && b) return (a + b).toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  const e = email?.trim();
  if (e) return e.slice(0, 2).toUpperCase();
  return "?";
}

function IconSettings({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

const profileShell =
  "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border-subtle)] bg-[var(--accent-muted)] text-xs font-semibold uppercase tracking-tight text-[var(--fg)] ring-offset-2 transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-[var(--bg-header)]";

const iconBtn =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--fg)] transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-header)]";

export function AppHeader({
  workspaceId,
}: {
  /** When set, profile and settings use this workspace in the URL. */
  workspaceId?: string;
}) {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const settingsHref = workspaceId ? `/app/w/${workspaceId}/settings` : undefined;
  const profileTitle = user?.email ? `Account (${user.email})` : "Account";
  const initials = user ? userInitials(user.name, user.email) : "?";
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const closeAccountMenu = useCallback(() => setAccountMenuOpen(false), []);

  useEffect(() => {
    if (!accountMenuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (accountMenuRef.current?.contains(e.target as Node)) return;
      setAccountMenuOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setAccountMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accountMenuOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[var(--bg-header)]">
      <div className="flex h-14 w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="group flex min-h-9 items-center gap-2 text-sm font-semibold tracking-tight text-[var(--fg)]"
          >
            <LogBaseMark variant="chrome" decorative />
            <span className="hidden leading-none sm:inline">LogBase</span>
          </Link>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {settingsHref && (
            <Link href={settingsHref} className={iconBtn} aria-label="User settings">
              <IconSettings className="size-[1.125rem]" />
            </Link>
          )}
          {user && (
            <div className="relative" ref={accountMenuRef}>
              <button
                type="button"
                className={profileShell}
                title={profileTitle}
                aria-label={profileTitle}
                aria-expanded={accountMenuOpen}
                aria-haspopup="true"
                aria-controls="account-menu"
                onClick={() => setAccountMenuOpen((o) => !o)}
              >
                {user.image ? (
                  <img src={user.image} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span aria-hidden>{initials}</span>
                )}
              </button>
              {accountMenuOpen && (
                <div
                  id="account-menu"
                  className="absolute right-0 top-full z-50 mt-1.5 min-w-[12rem] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] py-1 shadow-lg"
                >
                  {user.email && (
                    <p className="max-w-[16rem] truncate px-3 py-2 font-mono-ledger text-xs text-[var(--muted)]" title={user.email}>
                      {user.email}
                    </p>
                  )}
                  {settingsHref && (
                    <Link
                      href={settingsHref}
                      className="block px-3 py-2 text-sm text-[var(--fg)] hover:bg-[var(--surface-hover)]"
                      onClick={closeAccountMenu}
                    >
                      Your settings
                    </Link>
                  )}
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--surface-hover)]"
                    onClick={() => {
                      closeAccountMenu();
                      void authClient.signOut();
                    }}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
