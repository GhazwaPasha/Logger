"use client";

import { useEffect } from "react";

/** Hides the native scrollbar chrome for the marketing home only—removed on unmount so the
 * authenticated app (which relies on visible scrollbars for orientation in lists/tables) is
 * unaffected. */
export function HideScrollbar() {
  useEffect(() => {
    document.documentElement.classList.add("home-no-scrollbar");
    return () => document.documentElement.classList.remove("home-no-scrollbar");
  }, []);

  return null;
}
