"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LogBaseMark } from "@/components/brand/LogBaseMark";
import { useOptionalWorkspaceNotifications } from "@/components/notifications/WorkspaceNotificationsProvider";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { authClient } from "@/lib/auth-client";
import { HeaderLiveIsland } from "./live-island";
import { OnlineMembersAvatars } from "./OnlineMembersAvatars";

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

function IconBell({ className }: { className?: string }) {
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
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function IconMenu({ className }: { className?: string }) {
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
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
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
  "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border-subtle)] bg-[var(--accent-muted)] text-xs font-semibold uppercase tracking-tight text-[var(--fg)] ring-offset-2 transition-[background-color,transform,color] duration-200 ease-out hover:bg-[var(--surface-hover)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-[var(--bg-header)]";

const iconBtn =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--fg)] transition-[background-color,border-color,transform,color] duration-200 ease-out hover:bg-[var(--surface-hover)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-header)]";

export function AppHeader({
  workspaceSlug,
  onMenuToggle,
}: {
  /** When set, profile and settings use this workspace slug in the URL. */
  workspaceSlug?: string;
  onMenuToggle?: () => void;
}) {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  /** Header only mounts in authenticated chrome — never send users to marketing `/`. */
  const brandHref = workspaceSlug ? `/${workspaceSlug}/dashboard` : "/app";
  const settingsHref = workspaceSlug ? `/${workspaceSlug}/settings` : undefined;
  const profileTitle = user?.email ? `Account (${user.email})` : "Account";
  const initials = user ? userInitials(user.name, user.email) : "?";
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const notifications = useOptionalWorkspaceNotifications();

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
    <header className="ui-app-header sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[var(--bg-header)] supports-[backdrop-filter]:bg-[color-mix(in_srgb,var(--bg-header)_88%,transparent)] supports-[backdrop-filter]:backdrop-blur-md supports-[backdrop-filter]:backdrop-saturate-150">
      <div className="grid h-14 w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 sm:gap-3 sm:px-4 lg:px-5">
        <div className="flex min-w-0 items-center gap-3 justify-self-start">
          {onMenuToggle && (
            <button
              type="button"
              className={`${iconBtn} md:hidden`}
              aria-label="Open navigation"
              onClick={onMenuToggle}
            >
              <IconMenu className="size-[1.125rem]" />
            </button>
          )}
          <Link
            href={brandHref}
            className="group flex min-h-9 items-center gap-2 rounded-lg font-outfit font-semibold tracking-tight text-[var(--fg)] transition-[opacity,transform] duration-200 ease-out hover:opacity-90 active:scale-[0.98]"
          >
            <LogBaseMark variant="chrome" decorative />
            <span className="hidden text-lg leading-none sm:inline">LogBase</span>
          </Link>
        </div>
        <div className="pointer-events-none z-50 flex max-w-[min(100vw-8rem,22rem)] justify-center justify-self-center px-1 sm:max-w-[min(100vw-10rem,26rem)]">
          <HeaderLiveIsland />
        </div>
        <div className="flex min-w-0 items-center justify-end gap-2 justify-self-end sm:gap-3">
          {settingsHref && <GlobalSearch />}
          {settingsHref && <OnlineMembersAvatars />}
          {settingsHref && notifications && (
            <button
              type="button"
              className={`${iconBtn} relative`}
              aria-label={notifications.unreadCount > 0 ? `Notifications (${notifications.unreadCount} unread)` : "Notifications"}
              onClick={() => notifications.setPanelOpen(true)}
            >
              <IconBell className="size-[1.125rem]" />
              {notifications.unreadCount > 0 ? (
                <span
                  className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-[3px] bg-red-600 px-1.5 text-[11px] font-semibold tabular-nums leading-none text-white ring-2 ring-[var(--surface-elevated)]"
                  aria-hidden
                >
                  {notifications.unreadCount > 99 ? "99+" : notifications.unreadCount}
                </span>
              ) : null}
            </button>
          )}
          {settingsHref && (
            <Link href={settingsHref} className={iconBtn} aria-label="User settings">
              <IconSettings className="size-[1.125rem]" />
            </Link>
          )}
          {user && (
            <div className="relative" ref={accountMenuRef}>
              <div className="relative">
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
                <span
                  className="pointer-events-none absolute bottom-0.5 right-0.5 size-2.5 rounded-full bg-green-500 ring-2 ring-[var(--bg-header)]"
                  aria-hidden
                />
              </div>
              {accountMenuOpen && (
                <div
                  id="account-menu"
                  className="ui-dropdown-pop absolute right-0 top-full z-50 mt-1.5 min-w-[12rem] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] py-1 shadow-lg shadow-black/10 dark:shadow-black/40"
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
