"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { AppBootScreen } from "@/components/ui/LoadingFrame";

type BootCtx = { activate: () => void; deactivate: () => void };

const BootContext = createContext<BootCtx>({ activate: () => {}, deactivate: () => {} });

export function useBoot() {
  return useContext(BootContext);
}

export function BootProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);

  const activate = useCallback(() => setActive(true), []);
  const deactivate = useCallback(() => setActive(false), []);

  return (
    <BootContext.Provider value={{ activate, deactivate }}>
      {children}
      {active && (
        <div className="fixed inset-0 z-[9999]">
          <AppBootScreen />
        </div>
      )}
    </BootContext.Provider>
  );
}
