"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import type { ThemePref } from "@/hooks/useThemePreference";

export function AppHeader({
  theme,
  onThemeChange,
}: {
  theme: ThemePref;
  onThemeChange: (t: ThemePref) => void;
}) {
  const { data: session } = authClient.useSession();
  const pathname = usePathname();
  const inApp = pathname.startsWith("/app");

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[var(--bg-header)]/85 backdrop-blur-md">
      <div className="flex h-14 w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link href="/" className="group flex items-center gap-2 text-sm font-semibold tracking-tight text-[var(--fg)]">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-xs font-bold text-white">
              WL
            </span>
            <span className="hidden sm:inline">Work Ledger</span>
          </Link>
          {inApp && (
            <Link
              href="/app/workspaces"
              className="md:hidden rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs font-medium text-[var(--muted)] hover:border-[var(--accent)]/40 hover:text-[var(--fg)]"
            >
              Spaces
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {session?.user && (
            <span className="hidden max-w-[14rem] truncate text-xs text-[var(--muted)] md:inline font-mono-ledger">
              {session.user.email}
            </span>
          )}
          <label className="sr-only" htmlFor="theme-select">
            Theme
          </label>
          <select
            id="theme-select"
            className="input-compact max-w-[7.5rem] rounded-lg py-1.5 text-xs"
            value={theme}
            onChange={(e) => onThemeChange(e.target.value as ThemePref)}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          <button type="button" className="btn-secondary text-xs sm:text-sm" onClick={() => authClient.signOut()}>
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
