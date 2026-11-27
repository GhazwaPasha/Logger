import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { Pulse } from '@/components/motion/pulse';
import { Segmented } from '@/components/page';
import { Text } from '@/components/text';
import { alpha, cardSurface } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { useCompletionsByDay } from '@/lib/queries';

const RANGES = ['7', '14', '30'] as const;
type Range = (typeof RANGES)[number];

const CHART_H = 150;
const PAD_TOP = 10;
const PAD_BOTTOM = 20;

function shortDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(Date.UTC(y, m - 1, d));
}

/** Smooth path through points (Catmull-Rom → cubic Bézier), clamped so it never dips below the floor. */
function smoothPath(xs: number[], ys: number[], floor: number): string {
  if (xs.length === 0) return '';
  let d = `M${xs[0]} ${ys[0]}`;
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i - 1] ?? xs[i];
    const y0 = ys[i - 1] ?? ys[i];
    const x3 = xs[i + 2] ?? xs[i + 1];
    const y3 = ys[i + 2] ?? ys[i + 1];
    const c1x = xs[i] + (xs[i + 1] - x0) / 6;
    const c1y = Math.min(floor, ys[i] + (ys[i + 1] - y0) / 6);
    const c2x = xs[i + 1] - (x3 - xs[i]) / 6;
    const c2y = Math.min(floor, ys[i + 1] - (y3 - ys[i]) / 6);
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${xs[i + 1].toFixed(1)} ${ys[i + 1].toFixed(1)}`;
  }
  return d;
}

/**
 * "Tasks completed" (the web dashboard's chart), Apple Stocks style: a big readout over one smooth line — no
 * grid, no y-axis. Drag across the chart to read a single day; let go and the readout shows the period total
 * with how it compares to the period before. Fetches twice the window for that comparison.
 */
export function CompletionsChart({ orgId, timeZone }: { orgId: string | undefined; timeZone: string }) {
  const theme = useTheme();
  const [range, setRange] = useState<Range>('14');
  const n = Number(range);
  const q = useCompletionsByDay(orgId, n * 2, timeZone);
  const [hover, setHover] = useState<number | null>(null);
  const [w, setW] = useState(0);

  const model = useMemo(() => {
    const days = q.data;
    if (!days || days.length < n * 2) return null;
    const prev = days.slice(0, n);
    const cur = days.slice(n);
    const values = cur.map((d) => d.count);
    const total = values.reduce((a, b) => a + b, 0);
    const prevTotal = prev.reduce((a, d) => a + d.count, 0);
    return { cur, values, total, prevTotal };
  }, [q.data, n]);

  const geo = useMemo(() => {
    if (!model || w === 0) return null;
    const floor = CHART_H - PAD_BOTTOM;
    const max = Math.max(1, ...model.values) * 1.12;
    const x = (i: number) => (model.values.length === 1 ? w / 2 : (i / (model.values.length - 1)) * w);
    const y = (v: number) => floor - (v / max) * (floor - PAD_TOP);
    const xs = model.values.map((_, i) => x(i));
    const ys = model.values.map((v) => y(v));
    const line = smoothPath(xs, ys, floor);
    const area = `${line} L${xs[xs.length - 1]} ${floor} L${xs[0]} ${floor} Z`;
    return { floor, xs, ys, line, area };
  }, [model, w]);

  // Scrubbing: a horizontal drag holds the touch; a vertical one hands it back to the page scroll.
  const start = useRef({ x: 0, y: 0, horizontal: false });
  const indexAt = (lx: number) => {
    if (!model) return null;
    const count = model.values.length;
    return Math.max(0, Math.min(count - 1, Math.round((lx / Math.max(1, w)) * (count - 1))));
  };
  const scrubTo = (e: GestureResponderEvent) => {
    const i = indexAt(e.nativeEvent.locationX);
    if (i !== null && i !== hover) {
      haptics.select();
      setHover(i);
    }
  };

  const delta = model && model.prevTotal > 0 ? Math.round(((model.total - model.prevTotal) / model.prevTotal) * 100) : null;
  const scrubbing = hover !== null && !!model;
  const shownValue = model ? (scrubbing ? model.values[hover] : model.total) : 0;
  const color = theme.dept1;

  // The endpoint can be missing on an older API deploy; the card just stays out of the way then.
  if (q.isError) return null;

  return (
    <View style={[cardSurface(theme), styles.card]}>
      <View style={styles.head}>
        <Text font="outfit" size="base" weight="semibold" style={{ flex: 1 }}>
          Tasks completed
        </Text>
        <Segmented<Range>
          size="sm"
          value={range}
          onChange={(v) => {
            setRange(v);
            setHover(null);
          }}
          options={RANGES.map((r) => ({ value: r, label: `${r}D` }))}
        />
      </View>

      <View style={styles.readout} accessibilityLiveRegion="polite">
        {model ? (
          <>
            <Text size="xs" weight="semibold" color="muted">
              {scrubbing ? shortDate(model.cur[hover].date) : `Last ${n} days`}
            </Text>
            <View style={styles.figureRow}>
              <Text font="outfit" weight="semibold" tabular tracking={-1.2} style={styles.figure}>
                {shownValue}
              </Text>
              <Text size="sm" color="muted">
                {shownValue === 1 ? 'task' : 'tasks'}
              </Text>
              {!scrubbing && delta !== null ? (
                <View
                  style={[
                    styles.delta,
                    { backgroundColor: delta >= 0 ? theme.statusDoneBg : alpha(theme.danger, 0.12) },
                  ]}>
                  <Text size="xs" weight="semibold" tabular color={delta >= 0 ? theme.statusDoneInk : theme.danger}>
                    {`${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta)}%`}
                  </Text>
                </View>
              ) : null}
            </View>
          </>
        ) : (
          <View style={{ gap: 8 }}>
            <Pulse style={{ width: 80, height: 12, borderRadius: 6, backgroundColor: theme.fill2 }} />
            <Pulse style={{ width: 112, height: 32, borderRadius: 8, backgroundColor: theme.fill2 }} />
          </View>
        )}
      </View>

      <View
        style={styles.chart}
        onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}
        onStartShouldSetResponder={() => !!model}
        onResponderGrant={(e) => {
          start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, horizontal: false };
        }}
        onResponderMove={(e) => {
          const dx = Math.abs(e.nativeEvent.pageX - start.current.x);
          const dy = Math.abs(e.nativeEvent.pageY - start.current.y);
          if (!start.current.horizontal && dx > 6 && dx > dy) start.current.horizontal = true;
          if (start.current.horizontal) scrubTo(e);
        }}
        onResponderTerminationRequest={() => !start.current.horizontal}
        onResponderRelease={() => setHover(null)}
        onResponderTerminate={() => setHover(null)}
        accessibilityRole="image"
        accessibilityLabel={model ? `Tasks completed per day over the last ${n} days, ${model.total} in total` : undefined}>
        {!model || !geo ? (
          <Pulse style={[StyleSheet.absoluteFill, { top: 8, bottom: 24, borderRadius: 12, backgroundColor: theme.fill }]} />
        ) : (
          <Animated.View key={range} entering={FadeIn.duration(320)} style={StyleSheet.absoluteFill}>
            <Svg width={w} height={CHART_H}>
              <Defs>
                <LinearGradient id="completionsWash" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={color} stopOpacity={0.26} />
                  <Stop offset="1" stopColor={color} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Path d={geo.area} fill="url(#completionsWash)" />
              <Path d={geo.line} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              {scrubbing ? (
                <Line x1={geo.xs[hover]} x2={geo.xs[hover]} y1={0} y2={geo.floor} stroke={theme.ink3} strokeWidth={1} />
              ) : null}
            </Svg>
            <View
              pointerEvents="none"
              style={[
                styles.dot,
                {
                  backgroundColor: color,
                  borderColor: theme.card,
                  left: (scrubbing ? geo.xs[hover] : geo.xs[geo.xs.length - 1]) - 6.5,
                  top: (scrubbing ? geo.ys[hover] : geo.ys[geo.ys.length - 1]) - 6.5,
                },
              ]}
            />
            <View pointerEvents="none" style={styles.axis}>
              <Text size="11" weight="medium" color="ink3">
                {shortDate(model.cur[0].date)}
              </Text>
              <Text size="11" weight="medium" color="ink3">
                Today
              </Text>
            </View>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  readout: { marginTop: 12, minHeight: 58 },
  figureRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 2 },
  figure: { fontSize: 36, lineHeight: 40 },
  delta: { height: 24, paddingHorizontal: 8, borderRadius: 12, justifyContent: 'center', alignSelf: 'center', marginLeft: 2 },
  chart: { height: CHART_H, marginTop: 8 },
  dot: { position: 'absolute', width: 13, height: 13, borderRadius: 7, borderWidth: 2.5 },
  axis: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-between' },
});
