"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiJson } from "@/lib/api";
import { useApiSession } from "@/hooks/useApiSession";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";

type SearchResult = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueAt: string | null;
  listId: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-400/20 text-amber-700 dark:text-amber-300",
  in_progress: "bg-blue-400/20 text-blue-700 dark:text-blue-300",
  done: "bg-green-400/20 text-green-700 dark:text-green-300",
  cancelled: "bg-[var(--muted)]/20 text-[var(--muted)]",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  done: "Done",
  cancelled: "Cancelled",
  assigned: "Pending",
  late: "In Progress",
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function GlobalSearch() {
  const { workspaceId, workspaceSlug } = useWorkspaceRoute();
  const { token } = useApiSession();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setHighlighted(0);
    }
  }, [open]);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (trimmed.length < 2 || !token || !workspaceId) {
      setResults([]);
      return;
    }
    setLoading(true);
    apiJson<SearchResult[]>(
      `/organizations/${workspaceId}/search?q=${encodeURIComponent(trimmed)}`,
      { token },
    )
      .then((r) => {
        setResults(r);
        setHighlighted(0);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [debouncedQuery, token, workspaceId]);

  const openResult = useCallback(
    (result: SearchResult) => {
      router.push(`/${workspaceSlug}/work?task=${encodeURIComponent(result.id)}`);
      setOpen(false);
    },
    [router, workspaceSlug],
  );

  // Cmd+K / Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape" && open) setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && results[highlighted]) {
      openResult(results[highlighted]!);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative shrink-0 ${open ? "w-[22rem] sm:w-[28rem]" : ""}`}
    >
      <button
        type="button"
        aria-label="Search tasks (Ctrl+K)"
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] ${open ? "hidden" : ""}`}
      >
        <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0">
          <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9z" clipRule="evenodd" />
        </svg>
        <span className="hidden text-xs sm:inline">Search</span>
        <kbd className="hidden rounded border border-[var(--border)] px-1 py-0.5 text-[10px] font-medium leading-none sm:inline">⌘K</kbd>
      </button>

      {open && (
        <div className="absolute right-0 top-0 z-50 w-full">
          <div className="flex items-center gap-2 rounded-t-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 shadow-lg shadow-black/10 dark:shadow-black/30">
            <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0 text-[var(--muted)]">
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9z" clipRule="evenodd" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search tasks…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-w-0 flex-1 bg-transparent text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none"
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear"
                onClick={() => setQuery("")}
                className="shrink-0 text-[var(--muted)] hover:text-[var(--fg)]"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden>
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="shrink-0 text-xs text-[var(--muted)] hover:text-[var(--fg)]"
            >
              Esc
            </button>
          </div>

          {(loading || results.length > 0 || (query.trim().length >= 2 && !loading)) && (
            <div className="max-h-[22rem] overflow-y-auto rounded-b-lg border border-t-0 border-[var(--border)] bg-[var(--surface-elevated)] shadow-lg shadow-black/10 dark:shadow-black/30">
              {loading && (
                <div className="space-y-2 px-3 py-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex animate-pulse gap-2">
                      <div className="h-4 w-14 rounded bg-[var(--surface-hover)]" />
                      <div className="h-4 flex-1 rounded bg-[var(--surface-hover)]" />
                    </div>
                  ))}
                </div>
              )}
              {!loading && results.length === 0 && query.trim().length >= 2 && (
                <p className="px-4 py-3 text-sm text-[var(--muted)]">No results for "{query.trim()}"</p>
              )}
              {!loading && results.length > 0 && (
                <ul>
                  {results.map((result, i) => (
                    <li key={result.id}>
                      <button
                        type="button"
                        onClick={() => openResult(result)}
                        onMouseEnter={() => setHighlighted(i)}
                        className={`flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors ${i === highlighted ? "bg-[var(--surface-hover)]" : ""}`}
                      >
                        <span
                          className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_COLORS[result.status] ?? ""}`}
                        >
                          {STATUS_LABELS[result.status] ?? result.status}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-[var(--fg)]">{result.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
