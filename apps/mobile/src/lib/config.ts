import Constants from 'expo-constants';
import { NativeModules } from 'react-native';

const PROD_AUTH_URL = 'https://log-base.vercel.app';
const PROD_API_URL = 'https://logger-emfz.onrender.com';

/** The host part of `http://192.168.1.5:8081/...` or `192.168.1.5:8081`. */
function hostOf(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  const m = /^(?:[a-z]+:\/\/)?([^/:?#]+)/i.exec(value);
  const host = m?.[1];
  return host && host !== 'localhost' && host !== '127.0.0.1' ? host : undefined;
}

/**
 * In development the JS bundle is served from the dev machine, so its address tells us where the
 * local web (auth, :3000) and API (:4000) servers live — on emulators and real phones alike.
 *
 * `expoConfig.hostUri` is not populated in every dev-build setup (it was empty on SDK 57 dev builds,
 * silently sending dev builds to production), so fall back to the debugger host and finally to the
 * URL the bundle itself was loaded from.
 */
function detectDevHost(): string | undefined {
  if (!__DEV__) return undefined;
  const sourceCode = NativeModules.SourceCode as
    | { scriptURL?: string; getConstants?: () => { scriptURL?: string } }
    | undefined;
  let scriptURL: string | undefined;
  try {
    scriptURL = sourceCode?.getConstants?.().scriptURL ?? sourceCode?.scriptURL;
  } catch {
    scriptURL = undefined;
  }
  return (
    hostOf(Constants.expoConfig?.hostUri) ??
    hostOf(Constants.expoGoConfig?.debuggerHost) ??
    hostOf(scriptURL)
  );
}

const devHost = detectDevHost();

const stripSlash = (url: string) => url.replace(/\/$/, '');

/** Override either URL with EXPO_PUBLIC_AUTH_URL / EXPO_PUBLIC_API_URL (see .env.example). */
export const AUTH_URL = stripSlash(
  process.env.EXPO_PUBLIC_AUTH_URL || (devHost ? `http://${devHost}:3000` : PROD_AUTH_URL),
);
export const API_URL = stripSlash(
  process.env.EXPO_PUBLIC_API_URL || (devHost ? `http://${devHost}:4000` : PROD_API_URL),
);

if (__DEV__) {
  // One line in the Metro log so it's obvious which servers a dev build is talking to.
  console.log(`[config] API ${API_URL} · auth ${AUTH_URL}`);
}
