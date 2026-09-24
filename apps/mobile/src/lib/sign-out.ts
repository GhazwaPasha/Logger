import { useSyncExternalStore } from 'react';

import { authClient } from '@/lib/auth-client';
import { unregisterPush } from '@/lib/push';

/**
 * On from the moment the user signs out until they sign in again. better-auth can briefly report the old
 * session again while it refetches after `signOut()` (the app flashed back in between two sign-in screens),
 * so the root layout treats the user as signed out while this is on, whatever the hook says.
 */
let forcedOut = false;
const listeners = new Set<() => void>();
const setForcedOut = (v: boolean) => {
  if (forcedOut === v) return;
  forcedOut = v;
  listeners.forEach((l) => l());
};

export const useForcedSignOut = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => forcedOut,
  );
export const clearForcedSignOut = () => setForcedOut(false);

/**
 * Sign out of this device. The push token is dropped first (that call needs the session); cached data is
 * cleared by the root layout once the session is gone.
 */
export async function signOut() {
  await unregisterPush().catch(() => {});
  setForcedOut(true);
  await authClient.signOut();
}
