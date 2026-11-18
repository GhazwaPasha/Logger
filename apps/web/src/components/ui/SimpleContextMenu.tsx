"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/primitives/dropdown-menu";

export type SimpleContextMenuItem = {
  id: string;
  label: string;
  onSelect: () => void;
  destructive?: boolean;
};

/**
 * Right-click menu at a screen point, on the animate-ui DropdownMenu anchored to an invisible
 * point at (x, y): it grows from the click, flips at screen edges, and gets arrow keys,
 * type-ahead and focus return for free. Same props as before.
 */
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
  return (
    <DropdownMenu
      open={open && items.length > 0}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      modal={false}
    >
      <DropdownMenuTrigger asChild>
        <span
          aria-hidden
          tabIndex={-1}
          className="pointer-events-none fixed size-0"
          style={{ left: x, top: y }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="bottom"
        sideOffset={2}
        collisionPadding={8}
        className="z-[100] min-w-[9rem] max-w-[min(100vw-1rem,15rem)] max-h-[280px]"
      >
        {items.map((item) => (
          <DropdownMenuItem
            key={item.id}
            variant={item.destructive ? "destructive" : "default"}
            className="font-medium"
            onSelect={() => {
              onClose();
              queueMicrotask(() => item.onSelect());
            }}
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
