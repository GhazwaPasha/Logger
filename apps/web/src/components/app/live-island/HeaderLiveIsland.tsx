"use client";

import { useCallback, useSyncExternalStore, type CSSProperties } from "react";
import {
  getLiveIslandSnapshot,
  liveIsland,
  liveIslandServerSnapshot,
  subscribeLiveIsland,
  type LiveIslandVariant,
} from "./live-island-store";

function variantAccent(variant: LiveIslandVariant) {
  switch (variant) {
    case "success":
      return "#16a34a";
    case "error":
      return "#dc2626";
    case "warning":
      return "#ca8a04";
    default:
      return "#2563eb";
  }
}

function VariantIcon({ variant, className }: { variant: LiveIslandVariant; className?: string }) {
  const stroke = "currentColor";
  if (variant === "success") {
    return (
      <svg aria-hidden className={className} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.25">
        <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (variant === "error") {
    return (
      <svg aria-hidden className={className} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.25">
        <circle cx="12" cy="12" r="10" />
        <path d="m15 9-6 6M9 9l6 6" strokeLinecap="round" />
      </svg>
    );
  }
  if (variant === "warning") {
    return (
      <svg aria-hidden className={className} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.25">
        <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg aria-hidden className={className} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.25">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
    </svg>
  );
}

/** Header-centered live notification pill (Dynamic Island–inspired, LogBase theme). */
export function HeaderLiveIsland() {
  const { active, expanded, visible } = useSyncExternalStore(
    subscribeLiveIsland,
    getLiveIslandSnapshot,
    () => liveIslandServerSnapshot,
  );

  const onIslandClick = useCallback(() => {
    if (!active) return;
    if (expanded) {
      liveIsland.compact();
    } else {
      liveIsland.expand();
    }
  }, [active, expanded]);

  if (!active && !visible) return null;

  const showExpanded = Boolean(active && expanded && visible);
  const accent = active ? variantAccent(active.variant) : "var(--accent)";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={[
        "header-live-island",
        visible ? "header-live-island--visible" : "header-live-island--hidden",
        showExpanded ? "header-live-island--expanded" : "header-live-island--compact",
      ].join(" ")}
    >
      <button
        type="button"
        className="header-live-island__hit"
        onClick={onIslandClick}
        aria-label={active ? `${active.title}. ${active.description ?? ""} Tap to ${expanded ? "collapse" : "expand"}.` : "Notification"}
      >
        <span className="header-live-island__glow" style={{ "--island-accent": accent } as CSSProperties} aria-hidden />
        <span className="header-live-island__inner">
          {active ? (
            <>
              <span className="header-live-island__icon" style={{ color: accent }} aria-hidden>
                <VariantIcon variant={active.variant} className="size-3.5 shrink-0" />
              </span>
              <span className="header-live-island__copy">
                <span className="header-live-island__title">{active.title}</span>
                {showExpanded && active.description ? (
                  <span className="header-live-island__description">{active.description}</span>
                ) : null}
              </span>
              {showExpanded && active.action ? (
                <span
                  className="header-live-island__action"
                  role="presentation"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="header-live-island__action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      active.action?.onClick();
                      liveIsland.dismiss();
                    }}
                  >
                    {active.action.label}
                  </button>
                </span>
              ) : null}
            </>
          ) : null}
        </span>
      </button>
      {active ? (
        <button
          type="button"
          className="header-live-island__dismiss"
          aria-label="Dismiss notification"
          onClick={() => liveIsland.dismiss()}
        >
          <svg aria-hidden className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
