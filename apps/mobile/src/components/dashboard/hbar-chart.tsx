import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { Text } from '@/components/text';
import { Avatar } from '@/components/ui';
import { sequenceEnter } from '@/constants/motion';
import { alpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type BarRow = {
  key: string;
  label: string;
  value: number;
  /** Person rows: drawn as their avatar instead of the label (the label is still read out). */
  avatar?: { name?: string | null; email?: string | null; image?: string | null };
};

const LABEL_W = 92;
const AVATAR_LABEL_W = 36;
const AVATAR = 24;
/** Room past the longest bar for its value label. */
const VALUE_W = 34;
const ROW_H = 30;
const BAR_H = 14;
const TICKS = 4;

/** A round axis maximum ≥ `max` that splits into TICKS whole steps (1, 2, 5 × 10ⁿ per step). */
function niceMax(max: number) {
  if (max <= 0) return TICKS;
  const raw = max / TICKS;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  return Math.max(TICKS, Math.ceil(step) * TICKS);
}

function Bar({ value, axisMax, color, index }: { value: number; axisMax: number; color: string; index: number }) {
  const pct = axisMax ? (value / axisMax) * 100 : 0;
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withDelay(120 + index * 70, withTiming(pct, { duration: 650, easing: Easing.out(Easing.cubic) }));
  }, [pct, index, width]);

  const style = useAnimatedStyle(() => ({ width: `${width.value}%` }));
  return <Animated.View style={[styles.bar, { backgroundColor: color, minWidth: value > 0 ? 4 : 0 }, style]} />;
}

/**
 * Horizontal bar chart: names down the left, bars growing from a shared baseline across faint gridlines at
 * round steps, the value just past each bar's end, and the axis numbers underneath. The top row is drawn in full
 * colour and the rest a shade lighter, so the leader reads first. Sits straight on the page — no card.
 */
export function HBarChart({
  title,
  total,
  rows,
  color,
  emptyLabel,
  enterIndex,
}: {
  title: string;
  /** Shown quietly beside the title, e.g. "59 open". */
  total?: string;
  rows: BarRow[];
  color: string;
  emptyLabel: string;
  enterIndex: number;
}) {
  const theme = useTheme();
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const axisMax = niceMax(sorted[0]?.value ?? 0);
  const ticks = Array.from({ length: TICKS + 1 }, (_, i) => Math.round((axisMax / TICKS) * i));
  const grid = alpha(theme.fg, 0.07);

  return (
    <Animated.View entering={sequenceEnter(enterIndex, 8)} style={styles.wrap}>
      <View style={styles.head}>
        <Text font="outfit" size="base" weight="semibold" tracking={-0.2}>
          {title}
        </Text>
        {total ? (
          <Text size="xs" color="muted" tabular>
            {total}
          </Text>
        ) : null}
      </View>

      {sorted.length === 0 ? (
        <Text size="sm" color="muted">
          {emptyLabel}
        </Text>
      ) : (
        <View style={styles.chart}>
          <View style={{ width: sorted.some((r) => r.avatar) ? AVATAR_LABEL_W : LABEL_W }}>
            {sorted.map((r, i) => (
              <View key={r.key} style={styles.labelCell} accessible accessibilityLabel={`${r.label}: ${r.value}`}>
                {r.avatar ? (
                  <Avatar name={r.avatar.name} email={r.avatar.email} image={r.avatar.image} size={AVATAR} />
                ) : (
                  <Text size="13" weight={i === 0 ? 'semibold' : 'medium'} color={i === 0 ? 'fg' : 'muted'} numberOfLines={1}>
                    {r.label}
                  </Text>
                )}
              </View>
            ))}
          </View>

          <View style={{ flex: 1, marginRight: VALUE_W }}>
            {/* Gridlines at each tick, behind the bars. */}
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { bottom: 18 }]}>
              {ticks.map((t, i) => (
                <View
                  key={t}
                  style={[
                    styles.gridline,
                    { left: `${(i / TICKS) * 100}%`, backgroundColor: i === 0 ? alpha(theme.fg, 0.18) : grid },
                  ]}
                />
              ))}
            </View>

            {sorted.map((r, i) => (
              <View key={r.key} style={styles.barCell}>
                <Bar value={r.value} axisMax={axisMax} color={i === 0 ? color : alpha(color, 0.55)} index={i} />
                <Text size="xs" weight="semibold" tabular style={styles.value} numberOfLines={1}>
                  {r.value}
                </Text>
              </View>
            ))}

            {/* Axis numbers under the gridlines. */}
            <View style={styles.axis}>
              {ticks.map((t, i) => (
                <Text
                  key={t}
                  size="10"
                  color="muted"
                  tabular
                  style={[styles.tick, { left: `${(i / TICKS) * 100}%` }, i === 0 && { transform: [] }]}>
                  {t}
                </Text>
              ))}
            </View>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 4, paddingVertical: 6, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  chart: { flexDirection: 'row' },
  labelCell: { height: ROW_H, justifyContent: 'center', paddingRight: 10 },
  barCell: { height: ROW_H, flexDirection: 'row', alignItems: 'center' },
  bar: { height: BAR_H, borderTopRightRadius: BAR_H / 2, borderBottomRightRadius: BAR_H / 2, borderRadius: 3 },
  value: { marginLeft: 6, width: VALUE_W, marginRight: -VALUE_W },
  gridline: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth * 2 },
  axis: { height: 18, marginTop: 2 },
  // Centred under their gridline (the 0 sits flush with the baseline).
  tick: { position: 'absolute', top: 2, width: 32, marginLeft: -16, textAlign: 'center' },
});
