/** Route animation lives in persistent layouts (see RouteTransition); templates remount and cannot run exits. */
export default function AppEntryTemplate({ children }: { children: React.ReactNode }) {
  return children;
}
