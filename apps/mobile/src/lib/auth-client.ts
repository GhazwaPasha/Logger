import { expoClient } from '@better-auth/expo/client';
import { jwtClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';

import { AUTH_URL } from '@/lib/config';

/** Session cookies live in SecureStore (expoClient); the API is called with a short-lived JWT from `token()`. */
export const authClient = createAuthClient({
  baseURL: AUTH_URL,
  plugins: [
    expoClient({ scheme: 'logbase', storagePrefix: 'logbase', storage: SecureStore }),
    jwtClient(),
  ],
});
