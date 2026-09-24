import { authClient } from '@/lib/auth-client';
import { unregisterPush } from '@/lib/push';

/**
 * Sign out of this device. The push token is dropped first (that call needs the session); cached data is
 * cleared by the root layout once the session is gone.
 */
export async function signOut() {
  await unregisterPush();
  await authClient.signOut();
}
