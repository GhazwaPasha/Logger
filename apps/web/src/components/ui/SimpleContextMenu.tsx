"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

export type SimpleContextMenuItem = {
  id: string;
  label: string;
  onSelect: () => void;
  destructive?: boolean;
};

const MENU_MAX_H = 280;

export function SimpleContextMenu({
  open,
  x,
  y,
  items,
  onClose,
}: {
  open: boolean;
  x: number;
  y: number;
  items: SimpleContextMenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const el = ref.current;
    const rect = el.getBoundingClientRect();
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth - 8) left = window.innerWidth - rect.width - 8;
    if (top + rect.height > window.innerHeight - 8) top = window.innerHeight - rect.height - 8;
    left = Math.max(8, left);
    top = Math.max(8, top);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [open, x, y, items]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (ref.current?.contains(t)) return;
      onClose();
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, onClose]);

  if (!open || items.length === 0 || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={ref}
      role="menu"
      className="fixed z-[100] min-w-[8rem] max-w-[min(100vw-1rem,14rem)] overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] py-1 shadow-lg shadow-black/15 dark:shadow-black/50"
      style={{ left: x, top: y, maxHeight: MENU_MAX_H }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          className="flex w-full px-3 py-2 text-left text-sm font-medium text-[var(--fg)] transition-colors hover:bg-[var(--surface-hover)]"
          onClick={() => {
            onClose();
            queueMicrotask(() => item.onSelect());
          }}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
