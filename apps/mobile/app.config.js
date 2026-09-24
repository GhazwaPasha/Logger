/**
 * Extends app.json with the native Google sign-in plugin. Its iOS side needs the reversed iOS OAuth client ID
 * as a URL scheme (and refuses to build without one), so it's only added once that ID is configured; Android
 * needs no native config (Google matches the app by package name + signing SHA-1 instead).
 */
module.exports = ({ config }) => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const plugins = [...(config.plugins ?? [])];
  if (iosClientId) {
    // "123-abc.apps.googleusercontent.com" → "com.googleusercontent.apps.123-abc"
    const iosUrlScheme = `com.googleusercontent.apps.${iosClientId.replace('.apps.googleusercontent.com', '')}`;
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme }]);
  }
  return { ...config, plugins };
};
