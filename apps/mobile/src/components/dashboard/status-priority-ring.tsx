import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { PressableScale } from '@/components/motion/pressable-scale';
import { Pulse } from '@/components/motion/pulse';
import { useSequenceClock } from '@/components/motion/use-sequence-clock';
import { Text } from '@/components/text';
import { Duration, sequenceEnter, sequenceSettled, stateTransition } from '@/constants/motion';
import { alpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type RingSegment = { key: string; label: string; value: number; color: string };
type Half = 'top' | 'bottom';
type Focus = { half: Half; key: string } | null;

/** Arc thickness (viewBox units). */
const STROKE = 10;
/** Opacity of the pieces a focus isn't on. */
const DIMMED_OPACITY = 0.16;
/** Degrees between neighbouring pieces. */
const GAP_DEG = 4;
/**
 * Degrees left open on each side of the 3 and 9 o'clock seams — half a gap, so the seam between the two
 * halves is the same size as any other gap and the whole thing reads as one circle.
 */
const SEAM_DEG = GAP_DEG / 2;
/** How long a half takes to fill, piece by piece. */
const FILL_MS = 900;
/** Largest the ring and its legend get (the web's 17rem and 18rem). */
const RING_MAX = 272;
const LEGEND_MAX = 288;

/** Smallest slice of a half a non-zero segment is drawn with, so tiny counts stay visible. */
const MIN_SHARE = 0.07;
/** < 1 compresses the gap between big and small counts (1 would be exact proportions). */
const SHARE_EXPONENT = 0.6;

/**
 * How much of its half each segment is drawn with. Not exact maths: the shares are softened (raised to
 * SHARE_EXPONENT) so a dominant count doesn't swallow the ring, and every non-zero segment gets at least
 * MIN_SHARE. Big counts still read as big; small ones stay visible. Exact values live in the legend.
 */
function displayShares(segments: RingSegment[]): number[] {
  const total = segments.reduce((n, s) => n + s.value, 0);
  if (total === 0) return segments.map(() => 0);
  const soft = segments.map((s) => (s.value > 0 ? Math.pow(s.value / total, SHARE_EXPONENT) : 0));
  const softTotal = soft.reduce((a, b) => a + b, 0);
  const shares = soft.map((w) => w / softTotal);
  // Lift anything under the floor, then take that room back proportionally from the others.
  const lifted: number[] = shares.map((x) => (x > 0 && x < MIN_SHARE ? MIN_SHARE : 0));
  const liftedTotal = lifted.reduce((a, b) => a + b, 0);
  const restTotal = shares.reduce((n, x, i) => n + (lifted[i] ? 0 : x), 0);
  if (liftedTotal === 0 || restTotal === 0) return shares;
  return shares.map((x, i) => (lifted[i] ? lifted[i] : (x / restTotal) * (1 - liftedTotal)));
}

/**
 * Where each segment sits along its half, as fractions 0 → 1 in fill order. Each one is drawn as its own piece.
 */
function spans(segments: RingSegment[]) {
  const shares = displayShares(segments);
  const out: { seg: RingSegment; from: number; to: number }[] = [];
  let at = 0;
  segments.forEach((seg, i) => {
    if (shares[i] <= 0) return;
    out.push({ seg, from: at, to: at + shares[i] });
    at += shares[i];
  });
  return out;
}

/** SVG arc along the ring between two angles (degrees, clockwise from 3 o'clock). */
function arcPath(r: number, fromDeg: number, toDeg: number) {
  const [a, b] = fromDeg < toDeg ? [fromDeg, toDeg] : [toDeg, fromDeg];
  const pt = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return `${(100 + r * Math.cos(rad)).toFixed(3)} ${(100 + r * Math.sin(rad)).toFixed(3)}`;
  };
  return `M ${pt(a)} A ${r} ${r} 0 0 1 ${pt(b)}`;
}

/** SVG arc drawn from `fromDeg` towards `toDeg` (either way round), so a dash reveals it in that direction. */
function directedArc(r: number, fromDeg: number, toDeg: number) {
  const pt = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return `${(100 + r * Math.cos(rad)).toFixed(3)} ${(100 + r * Math.sin(rad)).toFixed(3)}`;
  };
  return `M ${pt(fromDeg)} A ${r} ${r} 0 0 ${toDeg > fromDeg ? 1 : 0} ${pt(toDeg)}`;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

/** Fades a piece of the ring back while the focus is on another one. */
function DimGroup({ dimmed, children }: { dimmed: boolean; children: ReactNode }) {
  const opacity = useSharedValue(dimmed ? DIMMED_OPACITY : 1);
  useEffect(() => {
    opacity.value = withTiming(dimmed ? DIMMED_OPACITY : 1, { duration: Duration.base });
  }, [dimmed, opacity]);
  const animated = useAnimatedProps(() => ({ opacity: opacity.value }));
  return <AnimatedG animatedProps={animated}>{children}</AnimatedG>;
}

/**
 * One coloured piece of the ring. Its geometry is fixed; only the dash offset follows `filled`, on the UI
 * thread, so the meter fills without re-rendering the ring every frame.
 */
function FillArc({
  filled,
  from,
  to,
  fromDeg,
  toDeg,
  r,
  color,
  stroke,
  startCap,
  endCap,
}: {
  filled: SharedValue<number>;
  /** The run's slice of its half, 0 → 1 in fill order. */
  from: number;
  to: number;
  fromDeg: number;
  toDeg: number;
  r: number;
  color: string;
  stroke: number;
  startCap: { x: number; y: number } | null;
  endCap: { x: number; y: number } | null;
}) {
  const length = (Math.abs(toDeg - fromDeg) * Math.PI * r) / 180;
  const arc = useAnimatedProps(() => {
    const shown = Math.min(1, Math.max(0, (filled.value - from) / (to - from)));
    return { strokeDashoffset: length * (1 - shown) };
  });
  const startDot = useAnimatedProps(() => ({ opacity: filled.value > from ? 1 : 0 }));
  const endDot = useAnimatedProps(() => ({ opacity: filled.value >= to - 1e-4 ? 1 : 0 }));
  // The static props are the empty state: animated props only land a frame after mount, and without these the
  // first frame would draw every arc and dot in full — a flash of the finished ring before it fills.
  return (
    <>
      <AnimatedPath
        d={directedArc(r, fromDeg, toDeg)}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={[length, length + 1]}
        strokeDashoffset={length}
        animatedProps={arc}
      />
      {startCap ? (
        <AnimatedCircle cx={startCap.x} cy={startCap.y} r={stroke / 2} fill={color} opacity={0} animatedProps={startDot} />
      ) : null}
      {endCap ? (
        <AnimatedCircle cx={endCap.x} cy={endCap.y} r={stroke / 2} fill={color} opacity={0} animatedProps={endDot} />
      ) : null}
    </>
  );
}

/**
 * The segmented ring, one piece per colour. Both halves fill left → right: the top half (status) over the top, the bottom half
 * (priority) under the bottom. With a `focus`, every other piece dims. The fill starts `fillAt`
 * ms after mount (so it can wait for an entrance to land). It stays empty
 * until `ready`, so numbers trickling in from separate queries don't each kick off a fill.
 */
function TickRing({
  top,
  bottom,
  size,
  focus,
  fillAt,
  ready,
}: {
  top: RingSegment[];
  bottom: RingSegment[];
  size: number;
  focus: Focus;
  fillAt: number;
  ready: boolean;
}) {
  const theme = useTheme();
  const signature = [...top, ...bottom].map((s) => s.value).join(',');
  const filled = useSharedValue(0);
  const delayUntil = useSequenceClock();

  // The fill plays once, when the numbers first land. Later changes (a teammate's edit arriving live, a refetch)
  // just redraw the ring full — replaying the fill for those made Home look like it was loading again.
  const hasFilled = useRef(false);
  useEffect(() => {
    if (!ready) {
      filled.value = 0;
      return;
    }
    if (hasFilled.current) {
      filled.value = 1;
      return;
    }
    hasFilled.current = true;
    filled.value = 0;
    // Ease out: quick at first, settling into the last pieces.
    filled.value = withDelay(delayUntil(fillAt), withTiming(1, { duration: FILL_MS, easing: Easing.out(Easing.cubic) }));
  }, [signature, fillAt, ready, filled, delayUntil]);

  const R = 84;
  const span = 180 - SEAM_DEG * 2;
  // Round caps reach past an arc's ends; pull each piece in by that much so the gaps stay even.
  const capDeg = ((STROKE / 2) / R) * (180 / Math.PI);
  const track = alpha(theme.fg, 0.08);

  // SVG angles run clockwise from 3 o'clock. Both halves fill left → right: the top half runs 180° → 360°
  // over the top, the bottom half 180° → 0° under the bottom.
  const halves: { half: Half; segments: RingSegment[]; dir: 1 | -1 }[] = [
    { half: 'top', segments: top, dir: 1 },
    { half: 'bottom', segments: bottom, dir: -1 },
  ];

  const point = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return { x: 100 + R * Math.cos(rad), y: 100 + R * Math.sin(rad) };
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      {halves.map(({ half, segments, dir }) => {
        const at = (deg: number) => 180 + dir * deg;
        const pieces = spans(segments);
        // Nothing to show yet: one empty track across the half.
        if (pieces.length === 0) {
          return (
            <Path
              key={`${half}-empty`}
              d={arcPath(R, at(SEAM_DEG + capDeg), at(SEAM_DEG + span - capDeg))}
              stroke={track}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
            />
          );
        }
        // Each segment is its own piece, as long as its share; the gaps sit only between colours.
        const room = span - GAP_DEG * (pieces.length - 1);
        return pieces.map((p, i) => {
          const start = SEAM_DEG + p.from * room + i * GAP_DEG;
          const end = start + (p.to - p.from) * room;
          const c0 = start + capDeg;
          // A sliver too short for its caps is drawn as a dot rather than flipping round.
          const c1 = Math.max(c0 + 0.01, end - capDeg);
          const dimmed = focus !== null && !(focus.half === half && focus.key === p.seg.key);
          return (
            <G key={`${half}-${p.seg.key}`}>
              <Path d={arcPath(R, at(c0), at(c1))} stroke={track} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
              <DimGroup dimmed={dimmed}>
                <FillArc
                  filled={filled}
                  from={p.from}
                  to={p.to}
                  fromDeg={at(c0)}
                  toDeg={at(c1)}
                  r={R}
                  color={p.seg.color}
                  stroke={STROKE}
                  startCap={point(at(c0))}
                  endCap={point(at(c1))}
                />
              </DimGroup>
            </G>
          );
        });
      })}
    </Svg>
  );
}

const sum = (segments: RingSegment[]) => segments.reduce((n, s) => n + s.value, 0);
const pct = (value: number, total: number) => (total ? Math.round((value / total) * 100) : 0);

/** The ring's centre: both totals, or — with a focus — that segment's value and share. */
function RingCentre({
  top,
  bottom,
  topLabel,
  bottomLabel,
  focus,
}: {
  top: RingSegment[];
  bottom: RingSegment[];
  topLabel: string;
  bottomLabel: string;
  focus: Focus;
}) {
  const theme = useTheme();
  const focused = focus ? (focus.half === 'top' ? top : bottom).find((s) => s.key === focus.key) : undefined;

  if (focus && focused) {
    const total = sum(focus.half === 'top' ? top : bottom);
    return (
      <View style={styles.centre} pointerEvents="none">
        <View style={[styles.focusDot, { backgroundColor: focused.color }]} />
        <Text size="3xl" weight="bold" tabular tracking={-1} lh={46} style={{ fontSize: 42 }}>
          {focused.value}
        </Text>
        <Text size="sm" weight="medium">
          {focused.label}
        </Text>
        <Text size="xs" color="muted" tabular>
          {`${pct(focused.value, total)}% of ${focus.half === 'top' ? topLabel : bottomLabel}`}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.centre} pointerEvents="none">
      <Text size="3xl" weight="bold" tabular tracking={-1} lh={38} style={styles.total}>
        {sum(top)}
      </Text>
      <Text size="11" color="muted" uppercase tracking={0.55}>
        {topLabel}
      </Text>
      <View style={[styles.centreSplit, { backgroundColor: theme.borderSubtle }]} />
      <Text size="3xl" weight="bold" tabular tracking={-1} lh={38} style={styles.total}>
        {sum(bottom)}
      </Text>
      <Text size="11" color="muted" uppercase tracking={0.55}>
        {bottomLabel}
      </Text>
    </View>
  );
}

/**
 * Dashboard hero: one big segmented ring — status mix across the top, priority across the bottom — with its legend
 * underneath. Tapping a legend row highlights that segment's piece and puts its number in the centre; tapping the
 * row again, or the ring, clears it.
 */
export function StatusPriorityRing({
  top,
  bottom,
  topTitle,
  bottomTitle,
  topLabel,
  bottomLabel,
  enterIndex,
  loading = false,
}: {
  top: RingSegment[];
  bottom: RingSegment[];
  topTitle: string;
  bottomTitle: string;
  topLabel: string;
  bottomLabel: string;
  /** Position in the page's entrance sequence; the ring starts filling once its entrance has landed. */
  enterIndex: number;
  /** Data still on its way: the centre shows a placeholder and the ring fills once the numbers land. */
  loading?: boolean;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [focus, setFocus] = useState<Focus>(null);

  const size = Math.min(width - 56, RING_MAX);

  return (
    <Animated.View entering={sequenceEnter(enterIndex, 8)} style={styles.hero}>
      <Pressable
        disabled={!focus}
        onPress={() => setFocus(null)}
        accessibilityRole="image"
        accessibilityLabel={`${topTitle}: ${sum(top)} ${topLabel}. ${bottomTitle}: ${sum(bottom)} ${bottomLabel}.`}
        accessibilityHint={focus ? 'Clears the highlight' : undefined}
        style={{ width: size, height: size }}>
        <TickRing top={top} bottom={bottom} size={size} focus={focus} fillAt={sequenceSettled(enterIndex)} ready={!loading} />
        <View style={StyleSheet.absoluteFill}>
          {loading ? (
            <View style={styles.centre} pointerEvents="none">
              <Pulse style={{ width: 56, height: 32, borderRadius: 8, backgroundColor: theme.surfaceMuted }} />
            </View>
          ) : (
            <RingCentre top={top} bottom={bottom} topLabel={topLabel} bottomLabel={bottomLabel} focus={focus} />
          )}
        </View>
      </Pressable>

      <View style={styles.legend}>
        <LegendGroup title={topTitle} half="top" segments={top} focus={focus} loading={loading} onFocus={setFocus} />
        <View style={[styles.legendSplit, { backgroundColor: theme.borderSubtle }]} />
        <LegendGroup title={bottomTitle} half="bottom" segments={bottom} focus={focus} loading={loading} onFocus={setFocus} />
      </View>
    </Animated.View>
  );
}

function LegendGroup({
  title,
  half,
  segments,
  focus,
  loading,
  onFocus,
}: {
  title: string;
  half: Half;
  segments: RingSegment[];
  focus: Focus;
  loading: boolean;
  onFocus: (f: Focus) => void;
}) {
  const total = sum(segments);
  return (
    <View>
      <Text size="10" weight="semibold" color="muted" uppercase tracking={0.5} style={styles.legendTitle}>
        {`${half === 'top' ? '▲' : '▼'} ${title}`}
      </Text>
      {segments.map((s) => {
        const active = focus?.half === half && focus.key === s.key;
        return (
          <PressableScale
            key={s.key}
            disabled={loading}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled: loading }}
            accessibilityLabel={loading ? s.label : `${s.label}: ${s.value}, ${pct(s.value, total)}%`}
            scaleTo={0.98}
            haptic="select"
            onPress={() => onFocus(active ? null : { half, key: s.key })}
            style={[styles.legendRow, { backgroundColor: active ? alpha(s.color, 0.16) : 'transparent' }, stateTransition]}>
            <View style={[styles.legendDot, { backgroundColor: s.color }]} />
            <Text size="sm" weight={active ? 'semibold' : 'medium'} numberOfLines={1} style={{ flex: 1 }}>
              {s.label}
            </Text>
            <Text size="xs" color="muted" tabular style={{ width: 40, textAlign: 'right' }}>
              {loading ? '' : `${pct(s.value, total)}%`}
            </Text>
            <Text size="sm" weight="semibold" tabular style={{ minWidth: 36, textAlign: 'right' }}>
              {loading ? '…' : s.value}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // No card: the ring and legend sit straight on the page, centred.
  hero: { alignItems: 'center', gap: 24, paddingVertical: 8 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  total: { fontSize: 34 },
  centreSplit: { width: '30%', height: StyleSheet.hairlineWidth * 2, marginVertical: 8 },
  focusDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 4 },
  legend: { width: '100%', maxWidth: LEGEND_MAX, gap: 12 },
  legendTitle: { paddingHorizontal: 10, paddingBottom: 4 },
  legendSplit: { height: StyleSheet.hairlineWidth * 2, marginHorizontal: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 38, paddingHorizontal: 10, borderRadius: 12 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
});
