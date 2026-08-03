"use client";

import { useEffect, useSyncExternalStore, type CSSProperties } from "react";
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

/** Header-centered live notification pill (Dynamic Island–inspired, LogBase theme). */
export function HeaderLiveIsland() {
  const { active, visible } = useSyncExternalStore(
    subscribeLiveIsland,
    getLiveIslandSnapshot,
    () => liveIslandServerSnapshot,
  );

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { liveIslandDebug?: typeof liveIsland }).liveIslandDebug = liveIsland;
    // eslint-disable-next-line no-console
    console.info(
      '[liveIslandDebug] Try: liveIslandDebug.info("Design review kickoff meeting notes and follow-ups", { description: "Tap to see what\'s new.", groupKey: "activity", titleForCount: n => n<=1 ? "First" : `New activity on ${n} tasks you follow`, action: { label: "Open", onClick: () => console.log("open") } })',
    );
  }, []);

  if (!active && !visible) return null;

  const accent = active ? variantAccent(active.variant) : "var(--accent)";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={["header-live-island", visible ? "header-live-island--visible" : "header-live-island--hidden"].join(
        " ",
      )}
    >
      <div className="header-live-island__hit">
        <span className="header-live-island__glow" style={{ "--island-accent": accent } as CSSProperties} aria-hidden />
        <span className="header-live-island__inner">
          {active ? (
            <>
              <span className="header-live-island__dot" style={{ background: accent }} aria-hidden />
              <span className="header-live-island__copy">
                <span className="header-live-island__title">{active.title}</span>
                {active.description ? (
                  <span className="header-live-island__description">{active.description}</span>
                ) : null}
              </span>
              {active.action ? (
                <button
                  type="button"
                  className="header-live-island__action-btn"
                  onClick={() => {
                    active.action?.onClick();
                    liveIsland.dismiss();
                  }}
                >
                  {active.action.label}
                </button>
              ) : null}
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
            </>
          ) : null}
        </span>
      </div>
    </div>
  );
}
