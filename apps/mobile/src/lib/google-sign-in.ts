import { Platform } from 'react-native';

/**
 * Native Google sign-in: the system account picker hands us a Google ID token, which better-auth verifies
 * server-side (`signIn.social({ provider: 'google', idToken })`) — no browser round trip.
 *
 * The token's audience is the *web* OAuth client (the one the auth server's GOOGLE_CLIENT_ID is), so that's
 * what `webClientId` must be. The Android / iOS OAuth clients only let Google recognise this app (package
 * name + SHA-1 on Android, bundle ID on iOS); see README "Native Google sign-in".
 */
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

/** Without the client IDs (or on web) the sign-in screen falls back to the browser flow. */
export const nativeGoogleSignIn =
  !!WEB_CLIENT_ID && (Platform.OS === 'android' || (Platform.OS === 'ios' && !!IOS_CLIENT_ID));

let configured = false;

/** Opens the Google account picker. Resolves to the ID token, or null if the user backed out. */
export async function pickGoogleIdToken(): Promise<string | null> {
  // Loaded on demand: the native module isn't in Expo Go, and importing it there would take the screen down.
  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = await import(
    '@react-native-google-signin/google-signin'
  );
  if (!configured) {
    GoogleSignin.configure({ webClientId: WEB_CLIENT_ID, iosClientId: IOS_CLIENT_ID });
    configured = true;
  }
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Forget the account picked last time, so the picker always shows and switching accounts is possible.
    await GoogleSignin.signOut().catch(() => undefined);
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res)) return null;
    if (!res.data.idToken) throw new Error('Google did not return an ID token.');
    return res.data.idToken;
  } catch (e) {
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS) return null;
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new Error('Google Play services are unavailable.');
    }
    throw e;
  }
}
