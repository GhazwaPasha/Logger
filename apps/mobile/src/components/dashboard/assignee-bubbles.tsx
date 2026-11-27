import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { PressableScale } from '@/components/motion/pressable-scale';
import { Pulse } from '@/components/motion/pulse';
import { Text } from '@/components/text';
import { Avatar } from '@/components/ui';
import { sequenceEnter } from '@/constants/motion';
import { cardSurface } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type BubbleItem = {
  key: string;
  label: string;
  value: number;
  avatar: { name?: string | null; email?: string | null; image?: string | null };
  onPress?: () => void;
};

/** A person's colour comes from their id, so it never changes when the ranking does. */
function hueIndex(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 4;
}

/** Hand-placed slots (centre %, largest first): a loose cluster that never overlaps for ≤ 6. */
const SLOTS: Record<number, { x: number; y: number }[]> = {
  1: [{ x: 50, y: 50 }],
  2: [{ x: 36, y: 50 }, { x: 72, y: 50 }],
  3: [{ x: 32, y: 50 }, { x: 68, y: 30 }, { x: 72, y: 74 }],
  4: [{ x: 28, y: 50 }, { x: 60, y: 27 }, { x: 62, y: 75 }, { x: 87, y: 50 }],
  5: [{ x: 25, y: 50 }, { x: 54, y: 25 }, { x: 56, y: 76 }, { x: 82, y: 33 }, { x: 84, y: 76 }],
  6: [{ x: 22, y: 50 }, { x: 48, y: 24 }, { x: 50, y: 76 }, { x: 72, y: 46 }, { x: 90, y: 20 }, { x: 89, y: 78 }],
};

const AREA_H = 220;

/** Assignee load (web dashboard): bubble area = open tasks; tap one to see that person's tasks. */
export function AssigneeBubbles({
  title,
  total,
  items,
  loading,
  emptyLabel,
  enterIndex,
}: {
  title: string;
  total: string;
  items: BubbleItem[];
  loading: boolean;
  emptyLabel: string;
  enterIndex: number;
}) {
  const theme = useTheme();
  const hues = [theme.dept1, theme.dept2, theme.dept3, theme.dept4];
  const tints = [theme.dept1Tint, theme.dept2Tint, theme.dept3Tint, theme.dept4Tint];
  const shown = items.filter((i) => i.value > 0).slice(0, 6);
  const max = Math.max(1, ...shown.map((i) => i.value));
  const slots = SLOTS[shown.length] ?? [];

  return (
    <Animated.View entering={sequenceEnter(enterIndex)} style={[cardSurface(theme), styles.card]}>
      <View style={styles.head}>
        <Text font="outfit" size="base" weight="semibold">
          {title}
        </Text>
        <Text size="13" color="muted">
          {total}
        </Text>
      </View>
      <Text size="13" color="muted" style={{ marginTop: 2 }}>
        Bubble size shows how much each person has open
      </Text>

      <View style={styles.area}>
        {loading ? (
          <Pulse style={[StyleSheet.absoluteFill, { borderRadius: 12, backgroundColor: theme.fill }]} />
        ) : shown.length === 0 ? (
          <View style={styles.empty}>
            <Text size="sm" color="muted">
              {emptyLabel}
            </Text>
          </View>
        ) : (
          shown.map((p, i) => {
            // Area ∝ value: diameter ∝ √value, between 50 and 116.
            const size = Math.round(50 + Math.sqrt(p.value / max) * 66);
            const k = hueIndex(p.key);
            return (
              <Animated.View
                key={p.key}
                entering={ZoomIn.springify().damping(14).delay(enterIndex * 60 + 120 + i * 70)}
                style={[
                  styles.slot,
                  {
                    left: `${slots[i].x}%`,
                    top: `${slots[i].y}%`,
                    width: size,
                    height: size,
                    marginLeft: -size / 2,
                    marginTop: -size / 2,
                  },
                ]}>
                <PressableScale
                  disabled={!p.onPress}
                  onPress={p.onPress}
                  haptic="select"
                  scaleTo={0.95}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.label}: ${p.value} open`}
                  style={[
                    styles.bubble,
                    { borderRadius: size / 2, backgroundColor: tints[k], borderColor: hues[k] },
                  ]}>
                  {size >= 90 ? <Avatar name={p.avatar.name} email={p.avatar.email} image={p.avatar.image} size={22} /> : null}
                  <Text
                    font="outfit"
                    weight="semibold"
                    tabular
                    tracking={-0.5}
                    style={{ fontSize: Math.round(13 + size / 9), lineHeight: Math.round(15 + size / 9) }}>
                    {p.value}
                  </Text>
                  <Text size="11" color="muted" numberOfLines={1} style={{ maxWidth: size - 14 }}>
                    {p.label.split(/\s+/)[0]}
                  </Text>
                </PressableScale>
              </Animated.View>
            );
          })
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  area: { height: AREA_H, marginTop: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  slot: { position: 'absolute' },
  bubble: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, borderWidth: 1.5 },
});
