/** Route animation lives in the persistent WorkspaceShell (RouteTransition), where exits can run. */
export default function WorkspaceAreaTemplate({ children }: { children: React.ReactNode }) {
  return children;
}
