import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

/** Channels tab: the category → channel list, with each channel's board pushed on top of it. */
export default function ChannelsLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: theme.surfaceBase },
      }}
    />
  );
}
