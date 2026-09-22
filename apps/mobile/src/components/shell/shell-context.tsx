import { createContext, useContext } from 'react';

type ShellValue = { openDrawer: () => void; closeDrawer: () => void; drawerOpen: boolean };

export const ShellContext = createContext<ShellValue | null>(null);

export function useShell(): ShellValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell must be used inside <Shell>');
  return ctx;
}
