import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ReducedMotionConfig, ReduceMotion } from 'react-native-reanimated';

import { useIsDark, useTheme, restoreThemePreference } from '@/hooks/use-theme';
import { authClient } from '@/lib/auth-client';
import { queryClient, wireQueryManagers } from '@/lib/query-client';

SplashScreen.preventAutoHideAsync();
void restoreThemePreference();

export default function RootLayout() {
  const dark = useIsDark();
  const theme = useTheme();
  const base = dark ? DarkTheme : DefaultTheme;
  const { data: session, isPending } = authClient.useSession();
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  useEffect(() => wireQueryManagers(), []);

  const ready = (fontsLoaded || !!fontError) && !isPending;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        value={{
          ...base,
          colors: {
            ...base.colors,
            background: theme.surfaceBase,
            card: theme.bgHeader,
            text: theme.fg,
            border: theme.borderSubtle,
            primary: theme.accent,
          },
        }}>
        {/* Honour the system's reduce-motion setting for every animation, like the web's motionDuration(). */}
        <ReducedMotionConfig mode={ReduceMotion.System} />
        <StatusBar style={dark ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.surfaceBase } }}>
          <Stack.Protected guard={!!session}>
            <Stack.Screen name="(app)" />
          </Stack.Protected>
          <Stack.Protected guard={!session}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
