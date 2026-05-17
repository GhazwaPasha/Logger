"use client";

import { useEffect, useState, createContext, useContext, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceRoute } from "./workspace-route-context";

type ShortcutsContextValue = { openHelp: () => void };
const ShortcutsContext = createContext<ShortcutsContextValue>({ openHelp: () => {} });
export function useShortcuts() { return useContext(ShortcutsContext); }

const SHORTCUTS = [
  { group: "Navigation", keys: ["G", "then D"], description: "Go to Dashboard" },
  { group: "Navigation", keys: ["G", "then W"], description: "Go to Work" },
  { group: "Navigation", keys: ["G", "then C"], description: "Go to Calendar" },
  { group: "Tasks", keys: ["N"], description: "Open new task form (Work page)" },
  { group: "Search", keys: ["⌘ K", "or Ctrl K"], description: "Open search" },
  { group: "General", keys: ["?"], description: "Show keyboard shortcuts" },
  { group: "General", keys: ["Esc"], description: "Close panel / modal" },
];

function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const groups = Array.from(new Set(SHORTCUTS.map((s) => s.group)));

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Keyboard Shortcuts</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-0.5 text-sm text-[var(--muted)] hover:bg-[var(--surface-muted)]"
          >
            Close
          </button>
        </div>
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                {group}
              </p>
              <ul className="space-y-1.5">
                {SHORTCUTS.filter((s) => s.group === group).map((s) => (
                  <li key={s.description} className="flex items-center justify-between text-sm">
                    <span className="text-[var(--fg)]">{s.description}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.map((k) => (
                        k.startsWith("or ") ? (
                          <span key={k} className="text-xs text-[var(--muted)]">{k}</span>
                        ) : (
                          <kbd
                            key={k}
                            className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-1.5 py-0.5 font-mono text-xs"
                          >
                            {k}
                          </kbd>
                        )
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function KeyboardShortcutsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { workspaceSlug } = useWorkspaceRoute();
  const [showHelp, setShowHelp] = useState(false);
  const [gPressed, setGPressed] = useState(false);

  useEffect(() => {
    let gTimeout: ReturnType<typeof setTimeout> | null = null;

    function handler(e: KeyboardEvent) {
      // Skip if user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      const isEditing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement)?.isContentEditable;
      const isMeta = e.metaKey || e.ctrlKey;

      if (e.key === "Escape") {
        setShowHelp(false);
        return;
      }

      // Cmd+K / Ctrl+K handled by GlobalSearch
      if (isMeta && e.key === "k") return;

      if (isEditing) return;

      if (e.key === "?") {
        e.preventDefault();
        setShowHelp((v) => !v);
        return;
      }

      // G-chord navigation
      if (e.key.toLowerCase() === "g") {
        setGPressed(true);
        if (gTimeout) clearTimeout(gTimeout);
        gTimeout = setTimeout(() => setGPressed(false), 1500);
        return;
      }

      if (gPressed) {
        if (e.key.toLowerCase() === "d") {
          e.preventDefault();
          router.push(`/${workspaceSlug}/dashboard`);
          setGPressed(false);
        } else if (e.key.toLowerCase() === "w") {
          e.preventDefault();
          router.push(`/${workspaceSlug}/work`);
          setGPressed(false);
        } else if (e.key.toLowerCase() === "c") {
          e.preventDefault();
          router.push(`/${workspaceSlug}/calendar`);
          setGPressed(false);
        }
        setGPressed(false);
        return;
      }

      // N = open new task (dispatched as custom event; work page listens)
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("wl:new-task"));
      }
    }

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (gTimeout) clearTimeout(gTimeout);
    };
  }, [router, workspaceSlug, gPressed]);

  return (
    <ShortcutsContext.Provider value={{ openHelp: () => setShowHelp(true) }}>
      {children}
      {showHelp && <ShortcutsHelp onClose={() => setShowHelp(false)} />}
    </ShortcutsContext.Provider>
  );
}
