import Constants from 'expo-constants';

const PROD_AUTH_URL = 'https://log-base.vercel.app';
const PROD_API_URL = 'https://logger-emfz.onrender.com';

/**
 * In development the JS bundle is served from the dev machine, so `hostUri` ("192.168.x.x:8081") tells
 * us where the local web (auth, :3000) and API (:4000) servers live — works on emulators and real phones.
 * Override either URL with EXPO_PUBLIC_AUTH_URL / EXPO_PUBLIC_API_URL (see .env.example).
 */
const devHost = __DEV__ ? Constants.expoConfig?.hostUri?.split(':')[0] : undefined;

const stripSlash = (url: string) => url.replace(/\/$/, '');

export const AUTH_URL = stripSlash(
  process.env.EXPO_PUBLIC_AUTH_URL || (devHost ? `http://${devHost}:3000` : PROD_AUTH_URL),
);
export const API_URL = stripSlash(
  process.env.EXPO_PUBLIC_API_URL || (devHost ? `http://${devHost}:4000` : PROD_API_URL),
);
