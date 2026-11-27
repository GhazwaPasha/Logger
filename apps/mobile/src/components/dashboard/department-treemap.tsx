import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { PressableScale } from '@/components/motion/pressable-scale';
import { Pulse } from '@/components/motion/pulse';
import { Text } from '@/components/text';
import { sequenceEnter } from '@/constants/motion';
import { cardSurface, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TreemapItem = {
  key: string;
  label: string;
  value: number;
  /** Position of the department in the workspace's own order — its colour follows the entity, not its rank. */
  colorIndex: number;
  onPress?: () => void;
};

type Rect = { x: number; y: number; w: number; h: number };
type Placed = TreemapItem & Rect;

const hues = (t: Palette) => [t.dept1, t.dept2, t.dept3, t.dept4];
const tints = (t: Palette) => [t.dept1Tint, t.dept2Tint, t.dept3Tint, t.dept4Tint];

/**
 * Slice-and-dice layout (the web's `DepartmentTreemap`): split the sorted items where they're closest to half
 * their weight, cut across the longer side first, then alternate — one big tile beside an unevenly split column.
 */
function layout(items: TreemapItem[], box: Rect, across = box.w >= box.h): Placed[] {
  if (items.length === 0) return [];
  if (items.length === 1) return [{ ...items[0], ...box }];
  const total = items.reduce((a, i) => a + i.value, 0);
  let acc = 0;
  let cut = 1;
  let best = Infinity;
  for (let i = 0; i < items.length - 1; i++) {
    acc += items[i].value;
    const miss = Math.abs(acc - total / 2);
    if (miss < best) {
      best = miss;
      cut = i + 1;
    }
  }
  const a = items.slice(0, cut);
  const b = items.slice(cut);
  const share = a.reduce((s, i) => s + i.value, 0) / total;
  if (across) {
    const w = box.w * share;
    return [...layout(a, { ...box, w }, false), ...layout(b, { x: box.x + w, y: box.y, w: box.w - w, h: box.h }, false)];
  }
  const h = box.h * share;
  return [...layout(a, { ...box, h }, true), ...layout(b, { x: box.x, y: box.y + h, w: box.w, h: box.h - h }, true)];
}

/** Half the gap between tiles: each tile is inset this much on every side, so every gap is equal. */
const HALF_GAP = 3;
/** Smallest share a department is drawn with, so a small one still fits its name and number. */
const MIN_SHARE = 0.2;
const AREA_H = 210;

function displayValues(items: TreemapItem[]): TreemapItem[] {
  const total = items.reduce((a, i) => a + i.value, 0);
  if (total === 0) return items;
  const lifted = items.map((i) => Math.max(i.value / total, MIN_SHARE));
  const sum = lifted.reduce((a, b) => a + b, 0);
  return items.map((i, k) => ({ ...i, value: lifted[k] / sum }));
}

/** Open tasks by department as a treemap of tinted tiles (web dashboard). Tap a tile to open that department. */
export function DepartmentTreemap({
  title,
  total,
  items,
  loading,
  emptyLabel,
  enterIndex,
}: {
  title: string;
  total: string;
  items: TreemapItem[];
  loading: boolean;
  emptyLabel: string;
  enterIndex: number;
}) {
  const theme = useTheme();
  const [w, setW] = useState(0);
  const live = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const none = items.filter((i) => i.value === 0);
  const sum = live.reduce((a, i) => a + i.value, 0);
  const real = new Map(live.map((i) => [i.key, i.value]));
  const placed = w > 0 ? layout(displayValues(live), { x: 0, y: 0, w, h: AREA_H }) : [];
  const H = hues(theme);
  const T = tints(theme);

  return (
    <Animated.View entering={sequenceEnter(enterIndex)} style={[cardSurface(theme), styles.card]}>
      <View style={styles.head}>
        <Text font="outfit" size="base" weight="semibold">
          {title}
        </Text>
        <Text size="13" color="muted" tabular>
          {total}
        </Text>
      </View>
      {none.length > 0 && live.length > 0 ? (
        <Text size="13" color="muted" numberOfLines={1} style={{ marginTop: 2 }}>
          {`${none.map((n) => n.label).join(', ')} ${none.length === 1 ? 'has' : 'have'} nothing open`}
        </Text>
      ) : null}

      <View style={styles.area} onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}>
        {loading ? (
          <Pulse style={[StyleSheet.absoluteFill, { margin: HALF_GAP, borderRadius: 10, backgroundColor: theme.fill }]} />
        ) : live.length === 0 ? (
          <View style={styles.empty}>
            <Text size="sm" color="muted">
              {emptyLabel}
            </Text>
          </View>
        ) : (
          placed.map((t, i) => {
            const value = real.get(t.key) ?? 0;
            const hue = H[t.colorIndex] ?? theme.ink3;
            const tint = T[t.colorIndex] ?? theme.fill2;
            const pct = Math.round((value / sum) * 100);
            const tileH = t.h - HALF_GAP * 2;
            const compact = tileH < 76;
            const big = !compact && t.w * t.h > 16000;
            return (
              <Animated.View
                key={t.key}
                entering={sequenceEnter(enterIndex + 1 + i, 8)}
                style={[styles.slot, { left: t.x, top: t.y, width: t.w, height: t.h }]}>
                <PressableScale
                  disabled={!t.onPress}
                  onPress={t.onPress}
                  haptic="select"
                  scaleTo={0.97}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.label}: ${value} open, ${pct}%`}
                  style={[styles.tile, compact ? styles.tileCompact : styles.tileFull, { backgroundColor: tint }]}>
                  {compact ? (
                    <>
                      <View style={[styles.dot, { backgroundColor: hue }]} />
                      <Text size="13" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
                        {t.label}
                      </Text>
                      <Text size="lg" lh={20} weight="semibold" tabular>
                        {value}
                      </Text>
                      <Text size="xs" color="muted" tabular>
                        {`${pct}%`}
                      </Text>
                    </>
                  ) : (
                    <>
                      <View style={styles.labelRow}>
                        <View style={[styles.dot, { backgroundColor: hue }]} />
                        <Text size="13" weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>
                          {t.label}
                        </Text>
                      </View>
                      <View style={styles.valueRow}>
                        <Text
                          font="outfit"
                          weight="semibold"
                          tabular
                          tracking={-0.8}
                          style={{ fontSize: big ? 34 : 24, lineHeight: big ? 36 : 26 }}>
                          {value}
                        </Text>
                        <Text size="13" color="muted" tabular>
                          {`${pct}%`}
                        </Text>
                      </View>
                    </>
                  )}
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
  area: { height: AREA_H, marginTop: 10, marginHorizontal: -HALF_GAP, marginBottom: -HALF_GAP },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  slot: { position: 'absolute', padding: HALF_GAP },
  tile: { flex: 1, borderRadius: 10, overflow: 'hidden' },
  tileCompact: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  tileFull: { justifyContent: 'space-between', padding: 12 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
