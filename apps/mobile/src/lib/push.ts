import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';

import { api } from '@/lib/api';

/**
 * Push notifications for task activity, sent by the API over Firebase Cloud Messaging with the same "is this
 * worth a notification" rule as the in-app bell (`@work-ledger/contracts`).
 *
 * Android only for now: on iOS the device token is an APNs token, which FCM can't address without the
 * Firebase iOS SDK (or an Expo push relay), so iOS keeps relying on the in-app bell.
 */
export const pushSupported = Platform.OS === 'android';

/** Android channel the API targets (`channelId: "activity"`); shown in system settings as "Task activity". */
const CHANNEL_ID = 'activity';
const TOKEN_KEY = 'logbase.push.token';

// In the foreground the bell's unread dot shows new activity; no system banner on top of the open app.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function register(token: string) {
  await api('/push/device-token', { method: 'POST', body: { token, platform: Platform.OS } });
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

/** Ask for permission (Android 13+ shows the system prompt once), then register this device for the user. */
async function registerForPush() {
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Task activity',
    description: 'Assignments, finished work, due-date changes and comments on your tasks.',
    importance: Notifications.AndroidImportance.HIGH,
  });
  // Android reports a never-asked permission as `denied` + `canAskAgain` (not `undetermined`), so ask whenever
  // it isn't granted and the system still allows asking — only an explicit "Don't allow" stops the prompt.
  let { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && canAskAgain) ({ status, canAskAgain } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return;
  const { data } = await Notifications.getDevicePushTokenAsync();
  if (typeof data === 'string' && data) await register(data);
}

export type PushPermission = 'granted' | 'ask' | 'blocked' | 'unsupported' | 'unknown';

/**
 * This device's push permission for Settings, re-checked whenever the app comes back to the foreground (the
 * user may have changed it in system settings). `enable()` asks when the system still allows asking, and
 * otherwise opens the app's system settings, where a blocked permission can be turned back on.
 */
export function usePushPermission() {
  const [state, setState] = useState<PushPermission>(pushSupported ? 'unknown' : 'unsupported');

  const refresh = useCallback(async () => {
    if (!pushSupported) return;
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    setState(status === 'granted' ? 'granted' : canAskAgain ? 'ask' : 'blocked');
  }, []);

  useEffect(() => {
    // Async: the state is set once the permission check resolves, not synchronously in the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const enable = useCallback(async () => {
    if (state === 'blocked') {
      await Linking.openSettings();
      return;
    }
    await registerForPush().catch(() => {});
    await refresh();
  }, [state, refresh]);

  return { state, enable };
}

/** Sign-out: stop pushing to this device. Needs the session, so call it before signing out. */
export async function unregisterPush() {
  const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
  if (!token) return;
  await api('/push/device-token', { method: 'DELETE', body: { token } }).catch(() => undefined);
  await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
}

/** The task a notification is about: in `content.data`, or on Android the FCM message's own data. */
function taskIdOf(response: Notifications.NotificationResponse): string | null {
  const { content, trigger } = response.notification.request;
  const fromContent = (content.data as Record<string, unknown> | null)?.taskId;
  const remote = (trigger as { remoteMessage?: { data?: Record<string, string> } } | null)?.remoteMessage;
  const id = fromContent ?? remote?.data?.taskId;
  return typeof id === 'string' && id ? id : null;
}

/**
 * Signed-in half of push: registers the device (and re-registers when FCM rotates the token), and opens the
 * task when a notification is tapped — including the one that launched the app.
 */
export function usePushNotifications(userId: string | null) {
  useEffect(() => {
    if (!pushSupported || !userId) return;
    registerForPush().catch(() => {
      // No network / API down: the next launch tries again.
    });
    const sub = Notifications.addPushTokenListener(({ data }) => {
      if (typeof data === 'string' && data) register(data).catch(() => {});
    });
    return () => sub.remove();
  }, [userId]);

  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!response || !userId) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    // Consumed: otherwise a later remount (e.g. signing out and back in) would reopen the same task.
    Notifications.clearLastNotificationResponse();
    const taskId = taskIdOf(response);
    if (taskId) router.push({ pathname: '/task/[id]', params: { id: taskId } });
  }, [response, userId]);
}
