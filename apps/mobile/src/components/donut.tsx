import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { Text } from '@/components/text';
import { useTheme } from '@/hooks/use-theme';

export type DonutSegment = { value: number; color: string };

/** Ring chart with a centre label (`DonutChart` in `kpi-primitives.tsx`). */
export function Donut({
  segments,
  label,
  emptyLabel,
  size = 96,
}: {
  segments: DonutSegment[];
  label: string;
  emptyLabel: string;
  size?: number;
}) {
  const theme = useTheme();
  const total = segments.reduce((n, s) => n + s.value, 0);
  const stroke = 12;
  const r = (100 - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <G rotation={-90} origin="50, 50">
          <Circle cx={50} cy={50} r={r} stroke={theme.surfaceMuted} strokeWidth={stroke} fill="none" />
          {total > 0
            ? segments
                .filter((s) => s.value > 0)
                .map((s, i) => {
                  const length = (s.value / total) * circumference;
                  const circle = (
                    <Circle
                      key={i}
                      cx={50}
                      cy={50}
                      r={r}
                      stroke={s.color}
                      strokeWidth={stroke}
                      fill="none"
                      strokeDasharray={`${length} ${circumference - length}`}
                      strokeDashoffset={-offset}
                    />
                  );
                  offset += length;
                  return circle;
                })
            : null}
        </G>
      </Svg>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.center}>
          {total > 0 ? (
            <>
              <Text size="xl" weight="semibold" tabular lh={22}>
                {total}
              </Text>
              <Text size="10" color="muted">
                {label}
              </Text>
            </>
          ) : (
            <Text size="10" color="muted" style={{ textAlign: 'center', paddingHorizontal: 12 }}>
              {emptyLabel}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
