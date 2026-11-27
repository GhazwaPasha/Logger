import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { StyleSheet, View } from 'react-native';

import { useIsDark, useTheme } from '@/hooks/use-theme';

/** Evaluated once: whether this build and OS can draw Apple's Liquid Glass (iOS 26+, Xcode 26 build). */
const GLASS = isLiquidGlassAvailable();

/**
 * Background of a floating bar piece. Liquid Glass on iOS 26; elsewhere an opaque elevated surface with a
 * hairline border. Always fills its parent — size the parent, never animate this view's opacity (a glass
 * view with opacity 0 anywhere up its tree stops rendering).
 */
export function BarSurface({ radius, nested }: { radius: number; nested?: boolean }) {
  const theme = useTheme();
  const dark = useIsDark();

  if (GLASS) {
    return (
      <GlassView
        glassEffectStyle="regular"
        isInteractive
        colorScheme={dark ? 'dark' : 'light'}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
    );
  }

  // A control inside a bar piece (e.g. the header's bell): without glass, the same surface would vanish into its
  // pill, so it sits one step up — a faint fill and a hairline edge.
  if (nested) {
    return (
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            backgroundColor: theme.fill2,
          },
        ]}
      />
    );
  }

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius: radius,
          // Opaque: any translucency lets page text bleed through the tabs and the panel. It's the web's raised
          // card (white in light, a step above the sheet in dark) with a hairline edge; the shadow sits on the parent.
          backgroundColor: theme.cardRaised,
          borderColor: theme.lineStrong,
          borderWidth: StyleSheet.hairlineWidth,
        },
      ]}
    />
  );
}

/** Drop shadow for the bar pieces (the glass draws its own on iOS 26). */
export const barShadow = GLASS
  ? null
  : {
      elevation: 8,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
    };

export const hasLiquidGlass = GLASS;
