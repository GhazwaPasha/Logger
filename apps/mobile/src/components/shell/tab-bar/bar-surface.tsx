import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { StyleSheet, View } from 'react-native';

import { alpha } from '@/constants/theme';
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
            backgroundColor: alpha(theme.fg, dark ? 0.08 : 0.06),
            borderColor: alpha(theme.fg, dark ? 0.1 : 0.07),
            borderWidth: StyleSheet.hairlineWidth * 2,
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
          // Opaque: any translucency lets page text bleed through the tabs and the panel. In dark mode it sits a
          // step above the page so the floating bar still reads as a separate layer.
          backgroundColor: dark ? theme.surfaceMuted : theme.surfaceElevated,
          borderColor: alpha(theme.fg, dark ? 0.1 : 0.07),
          borderWidth: StyleSheet.hairlineWidth * 2,
        },
      ]}
    />
  );
}

/** Drop shadow for the bar pieces (the glass draws its own on iOS 26). */
export const barShadow = GLASS
  ? null
  : {
      elevation: 10,
      shadowColor: '#000',
      shadowOpacity: 0.16,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    };

export const hasLiquidGlass = GLASS;
