"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      className={`h-4 w-4 shrink-0 text-[var(--muted)] transition-transform duration-150 ${open ? "rotate-90" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function rowBase(active: boolean) {
  return [
    "flex min-w-0 items-center gap-1 rounded-md py-1.5 pr-2 text-left text-sm transition-colors",
    active ? "bg-[var(--accent-muted)] font-medium text-[var(--fg)]" : "text-[var(--fg)] hover:bg-[var(--surface-hover)]",
  ].join(" ");
}

/**
 * Sidebar for `/app` when the user has no organizations: account row only,
 * expanding to “Add workspace” (main content is the add-workspace flow).
 */
export function AppEntryAccountSidebar() {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const [pickerOpen, setPickerOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  const userLabel = session?.user?.name?.trim() || session?.user?.email || "Account";
  const userSubLabel = session?.user?.email && session.user.name ? session.user.email : null;

  const closePicker = useCallback(() => setPickerOpen(false), []);

  useEffect(() => {
    if (!pickerOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (navRef.current?.contains(e.target as Node)) return;
      setPickerOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setPickerOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [pickerOpen]);

  return (
    <aside className="flex max-h-[70vh] min-h-0 w-full shrink-0 flex-col border-b border-[var(--border-subtle)] bg-[var(--surface-nav)] md:max-h-none md:h-[calc(100vh-3.5rem)] md:w-72 md:border-b-0 md:border-r">
      <nav ref={navRef} className="flex min-h-0 flex-1 flex-col overflow-hidden" aria-label="Account">
        <div className="shrink-0 border-b border-[var(--border-subtle)] p-2">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-[var(--surface-hover)]"
            aria-expanded={pickerOpen}
            aria-label="Toggle account menu"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--fg)]">{userLabel}</p>
              {userSubLabel && <p className="truncate text-xs text-[var(--muted)]">{userSubLabel}</p>}
            </div>
            <Chevron open={pickerOpen} />
          </button>
          {pickerOpen && (
            <div className="mt-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-1">
              <Link
                href="/app"
                className={`${rowBase(pathname === "/app")} mt-0 block pl-2`}
                onClick={closePicker}
              >
                + Add workspace
              </Link>
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
}
