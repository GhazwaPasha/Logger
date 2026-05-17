"use client";

import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

type OnlinePresenceContextValue = {
  onlineUserIds: ReadonlySet<string>;
  setOnlineUserIds: Dispatch<SetStateAction<Set<string>>>;
  awayUserIds: ReadonlySet<string>;
  setAwayUserIds: Dispatch<SetStateAction<Set<string>>>;
};

const OnlinePresenceContext = createContext<OnlinePresenceContextValue | null>(null);

export function OnlinePresenceProvider({ children }: { children: ReactNode }) {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [awayUserIds, setAwayUserIds] = useState<Set<string>>(new Set());
  return (
    <OnlinePresenceContext.Provider value={{ onlineUserIds, setOnlineUserIds, awayUserIds, setAwayUserIds }}>
      {children}
    </OnlinePresenceContext.Provider>
  );
}

export function useOnlinePresence(): OnlinePresenceContextValue {
  const ctx = useContext(OnlinePresenceContext);
  if (!ctx) throw new Error("useOnlinePresence must be used within OnlinePresenceProvider");
  return ctx;
}
