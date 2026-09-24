import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { LogoMark } from '@/components/logo-mark';
import { sequenceEnter } from '@/constants/motion';
import { alpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The web's connecting step (`LoginForm.tsx` → `ConnectingStep`, `auth-combo-seq-*` in globals.css): no card,
 * no text — the LogBase mark, three dots and the provider's logo, all the same size. One shared 3.5s cycle
 * split into five 0.7s turns, so exactly one element pulses at a time, in order: logo, dot, dot, dot, provider.
 */
const CYCLE_MS = 3500;
const TURN_MS = CYCLE_MS / 5;
/** Share of the cycle each pulse takes (the keyframes' 0% → 20%); the rest of the cycle it's at rest. */
const PULSE = 0.2;
const BADGE = 112;
const MARK = 84;
const DOT = 16;
/** How far the ring spreads past the badge at its peak (the web's 14px box-shadow). */
const RING_SPREAD = 14;

/** 0 at rest → 1 at the middle of this element's turn → 0, eased in and out. */
function pulseAt(clock: number, delay: number) {
  'worklet';
  const f = ((((clock - delay) % CYCLE_MS) + CYCLE_MS) % CYCLE_MS) / CYCLE_MS;
  return f < PULSE ? (1 - Math.cos((2 * Math.PI * f) / PULSE)) / 2 : 0;
}

function Badge({ clock, delay, color, children }: { clock: SharedValue<number>; delay: number; color: string; children: ReactNode }) {
  // A band around the badge, like a CSS box-shadow spread: it widens outward (the badge itself stays clear)
  // while fading in, then shrinks back.
  const ring = useAnimatedStyle(() => {
    const k = pulseAt(clock.value, delay);
    const s = RING_SPREAD * k;
    const d = BADGE + s * 2;
    return { opacity: k, width: d, height: d, borderRadius: d / 2, borderWidth: s, top: -s, left: -s };
  });
  return (
    <View style={styles.badge}>
      <Animated.View style={[styles.ring, { borderColor: alpha(color, 0.32) }, ring]} />
      {children}
    </View>
  );
}

function Dot({ clock, delay, color }: { clock: SharedValue<number>; delay: number; color: string }) {
  const style = useAnimatedStyle(() => {
    const k = pulseAt(clock.value, delay);
    return { opacity: 0.3 + 0.7 * k, transform: [{ scale: 0.75 + 0.35 * k }] };
  });
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

export function ConnectingStep({ label, icon, color }: { label: string; icon: IconDefinition; color: string }) {
  const theme = useTheme();
  const clock = useSharedValue(0);

  useEffect(() => {
    clock.value = withRepeat(withTiming(CYCLE_MS, { duration: CYCLE_MS, easing: Easing.linear }), -1, false);
  }, [clock]);

  return (
    <Animated.View
      entering={sequenceEnter(0, 8)}
      style={styles.wrap}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Connecting to ${label}`}>
      <Badge clock={clock} delay={0} color={theme.accent}>
        <LogoMark size={MARK} />
      </Badge>
      <View style={styles.dots}>
        {[1, 2, 3].map((i) => (
          <Dot key={i} clock={clock} delay={i * TURN_MS} color={theme.fg} />
        ))}
      </View>
      <Badge clock={clock} delay={4 * TURN_MS} color={color}>
        <Icon icon={icon} size={MARK} color={color} />
      </Badge>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: 32, paddingVertical: 24 },
  badge: { width: BADGE, height: BADGE, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
});
