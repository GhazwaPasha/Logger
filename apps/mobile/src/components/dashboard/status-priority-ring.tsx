import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Pulse } from '@/components/motion/pulse';
import { usePresence } from '@/components/motion/use-presence';
import { useSequenceClock } from '@/components/motion/use-sequence-clock';
import { Text } from '@/components/text';
import { Duration, POP_EASE, sequenceEnter, sequenceSettled } from '@/constants/motion';
import { alpha, Radius } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';

export type RingSegment = { key: string; label: string; value: number; color: string };
type Half = 'top' | 'bottom';
type Focus = { half: Half; key: string } | null;

/** Chunks per half: the top half (status) is split into 4, the bottom half (priority) into 3. */
const TOP_CHUNKS = 4;
const BOTTOM_CHUNKS = 3;
/** Arc thickness on the dashboard and in the focused view (viewBox units). */
const HERO_STROKE = 10;
const FOCUS_STROKE = 12;
/** Degrees between neighbouring chunks. */
const CHUNK_GAP_DEG = 4;
/**
 * Degrees left open on each side of the 3 and 9 o'clock seams — half a chunk gap, so the seam between the two
 * halves is the same size as any other gap and the whole thing reads as one circle.
 */
const SEAM_DEG = CHUNK_GAP_DEG / 2;
/** How long a half takes to fill, chunk by chunk. */
const FILL_MS = 900;
/** In the focused view, the ring starts filling once the stage has mostly sprung in. */
const FOCUS_FILL_AT = 160;

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
 * Where each segment sits along its half, as fractions 0 → 1 in fill order. The chunks are only slots on top
 * of this: a segment flows through as many chunks as it needs, so one chunk can hold several colours.
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

/**
 * One coloured run inside a chunk. Its geometry is fixed; only the dash offset follows `filled`, on the UI
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
 * The chunked ring. Both halves fill left → right: the top half (status) over the top, the bottom half
 * (priority) under the bottom. With a `focus`, every chunk outside that segment dims. The fill starts `fillAt`
 * ms after mount (so it can wait for an entrance to land) and replays whenever the data changes. It stays empty
 * until `ready`, so numbers trickling in from separate queries don't each kick off a fill.
 */
function TickRing({
  top,
  bottom,
  size,
  focus,
  stroke,
  fillAt = 0,
  ready = true,
}: {
  top: RingSegment[];
  bottom: RingSegment[];
  size: number;
  focus: Focus;
  /** Arc thickness, in the ring's 200-unit viewBox. */
  stroke: number;
  fillAt?: number;
  ready?: boolean;
}) {
  const theme = useTheme();
  const dark = useIsDark();
  const signature = [...top, ...bottom].map((s) => s.value).join(',');
  const filled = useSharedValue(0);
  const delayUntil = useSequenceClock();

  useEffect(() => {
    filled.value = 0;
    if (!ready) return;
    // Ease out: quick at first, settling into the last chunks.
    filled.value = withDelay(delayUntil(fillAt), withTiming(1, { duration: FILL_MS, easing: Easing.out(Easing.cubic) }));
  }, [signature, fillAt, ready, filled, delayUntil]);

  const R = 84;
  const span = 180 - SEAM_DEG * 2;
  // Round caps reach past an arc's ends; pull each chunk in by that much so the gaps stay even.
  const capDeg = ((stroke / 2) / R) * (180 / Math.PI);
  const track = alpha(theme.fg, dark ? 0.1 : 0.08);

  // SVG angles run clockwise from 3 o'clock. Both halves fill left → right: the top half runs 180° → 360°
  // over the top, the bottom half 180° → 0° under the bottom.
  const halves: { half: Half; segments: RingSegment[]; chunks: number; dir: 1 | -1 }[] = [
    { half: 'top', segments: top, chunks: TOP_CHUNKS, dir: 1 },
    { half: 'bottom', segments: bottom, chunks: BOTTOM_CHUNKS, dir: -1 },
  ];

  const point = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return { x: 100 + R * Math.cos(rad), y: 100 + R * Math.sin(rad) };
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      {halves.map(({ half, segments, chunks, dir }) => {
        const each = (span - CHUNK_GAP_DEG * (chunks - 1)) / chunks;
        const pieces = spans(segments);
        return Array.from({ length: chunks }, (_, i) => {
          // The chunk's drawable arc (degrees along the half), inset for the round caps.
          const c0 = SEAM_DEG + i * (each + CHUNK_GAP_DEG) + capDeg;
          const c1 = SEAM_DEG + i * (each + CHUNK_GAP_DEG) + each - capDeg;
          // The slice of the data (0 → 1) this chunk shows; how much of it is drawn follows `filled`.
          const f0 = i / chunks;
          const f1 = (i + 1) / chunks;
          const toDeg = (f: number) => c0 + ((f - f0) * chunks) * (c1 - c0);
          const at = (deg: number) => 180 + dir * deg;

          const parts = pieces
            .map((p) => ({ seg: p.seg, from: Math.max(p.from, f0), to: Math.min(p.to, f1) }))
            .filter((p) => p.to > p.from);

          return (
            <G key={`${half}-${i}`}>
              <Path d={arcPath(R, at(c0), at(c1))} stroke={track} strokeWidth={stroke} strokeLinecap="round" fill="none" />
              {parts.map((p) => {
                const dimmed = focus !== null && !(focus.half === half && focus.key === p.seg.key);
                const d0 = toDeg(p.from);
                const d1 = toDeg(p.to);
                // Butt ends inside the chunk (colours meet edge to edge); a dot rounds off the chunk's own ends.
                // (Compared with a tolerance: the running sums behind `spans` pick up float error.)
                return (
                  <G key={p.seg.key} opacity={dimmed ? 0.16 : 1}>
                    <FillArc
                      filled={filled}
                      from={p.from}
                      to={p.to}
                      fromDeg={at(d0)}
                      toDeg={at(d1)}
                      r={R}
                      color={p.seg.color}
                      stroke={stroke}
                      startCap={Math.abs(p.from - f0) < 1e-6 ? point(at(d0)) : null}
                      endCap={Math.abs(p.to - f1) < 1e-6 ? point(at(d1)) : null}
                    />
                  </G>
                );
              })}
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
  large,
  hint,
}: {
  top: RingSegment[];
  bottom: RingSegment[];
  topLabel: string;
  bottomLabel: string;
  focus: Focus;
  large?: boolean;
  /** Hero only: a "Tap for more" hint between the two totals, in place of the hairline. */
  hint?: boolean;
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

  const numberStyle = { fontSize: large ? 40 : 32 };
  return (
    <View style={styles.centre} pointerEvents="none">
      <Text size="3xl" weight="bold" tabular tracking={-1} lh={large ? 44 : 36} style={numberStyle}>
        {sum(top)}
      </Text>
      <Text size="11" color="muted" uppercase tracking={0.8}>
        {topLabel}
      </Text>
      {hint ? (
        <View style={[styles.hint, { backgroundColor: alpha(theme.fg, 0.06) }]}>
          <Text size="10" weight="semibold" color="muted" uppercase tracking={0.6}>
            Tap for more
          </Text>
        </View>
      ) : (
        <View style={[styles.centreSplit, { backgroundColor: theme.borderSubtle }]} />
      )}
      <Text size="3xl" weight="bold" tabular tracking={-1} lh={large ? 44 : 36} style={numberStyle}>
        {sum(bottom)}
      </Text>
      <Text size="11" color="muted" uppercase tracking={0.8}>
        {bottomLabel}
      </Text>
    </View>
  );
}

/**
 * Dashboard hero: one big chunked ring — status mix across the top, priority across the bottom — with no
 * legend. Tapping it brings the ring into focus over a dimmed screen and reveals the legend; tapping a legend
 * row highlights that segment's chunks.
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
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState<Focus>(null);
  const { mounted, progress } = usePresence(open, { spring: true });

  const heroSize = Math.min(width - 56, 300);
  const focusSize = Math.min(width - 48, height * 0.42, 340);

  const backdrop = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, progress.value)) }));
  const stage = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, progress.value));
    return { opacity: p, transform: [{ scale: 0.86 + 0.14 * p }, { translateY: (1 - p) * 40 }] };
  });

  const close = () => {
    setOpen(false);
    setFocus(null);
  };

  return (
    <>
      <Animated.View entering={sequenceEnter(enterIndex, 8)}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${topTitle} and ${bottomTitle}. ${sum(top)} ${topLabel}, ${sum(bottom)} ${bottomLabel}. Show breakdown`}
          scaleTo={0.985}
          haptic="tap"
          onPress={() => setOpen(true)}
          style={[styles.hero, { width: heroSize, height: heroSize }]}>
          <TickRing
            top={top}
            bottom={bottom}
            size={heroSize}
            focus={null}
            stroke={HERO_STROKE}
            fillAt={sequenceSettled(enterIndex)}
            ready={!loading}
          />
          <View style={StyleSheet.absoluteFill}>
            {loading ? (
              <View style={styles.centre} pointerEvents="none">
                <Pulse style={{ width: 56, height: 30, borderRadius: 8, backgroundColor: alpha(theme.fg, 0.1) }} />
              </View>
            ) : (
              <RingCentre top={top} bottom={bottom} topLabel={topLabel} bottomLabel={bottomLabel} focus={null} hint />
            )}
          </View>
        </PressableScale>
      </Animated.View>

      <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={close}>
        {/* Near-opaque page colour: the dashboard underneath shouldn't read through and compete with the ring. */}
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: alpha(theme.surfaceBase, 0.97) }, backdrop]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close breakdown" />
        </Animated.View>

        <Animated.View
          pointerEvents="box-none"
          style={[styles.stage, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }, stage]}>
          <View style={styles.stageHead}>
            <Text font="outfit" size="lg" weight="bold">
              {`${topTitle} & ${bottomTitle}`}
            </Text>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Close"
              scaleTo={0.9}
              hitSlop={8}
              onPress={close}
              style={[styles.closeBtn, { backgroundColor: alpha(theme.fg, 0.08) }]}>
              <Icon icon={faXmark} size={16} color="fg" />
            </PressableScale>
          </View>

          <Pressable
            onPress={() => setFocus(null)}
            accessibilityLabel="Clear highlight"
            style={[styles.focusRing, { width: focusSize, height: focusSize }]}>
            <TickRing top={top} bottom={bottom} size={focusSize} focus={focus} stroke={FOCUS_STROKE} fillAt={FOCUS_FILL_AT} />
            <View style={StyleSheet.absoluteFill}>
              <RingCentre top={top} bottom={bottom} topLabel={topLabel} bottomLabel={bottomLabel} focus={focus} large />
            </View>
          </Pressable>

          <View style={[styles.legendCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle }]}>
            <LegendGroup
              title={topTitle}
              half="top"
              segments={top}
              focus={focus}
              onFocus={setFocus}
              enterFrom={0}
            />
            <View style={[styles.legendSplit, { backgroundColor: theme.borderSubtle }]} />
            <LegendGroup
              title={bottomTitle}
              half="bottom"
              segments={bottom}
              focus={focus}
              onFocus={setFocus}
              enterFrom={top.length + 1}
            />
          </View>
        </Animated.View>
      </Modal>
    </>
  );
}

function LegendGroup({
  title,
  half,
  segments,
  focus,
  onFocus,
  enterFrom,
}: {
  title: string;
  half: Half;
  segments: RingSegment[];
  focus: Focus;
  onFocus: (f: Focus) => void;
  enterFrom: number;
}) {
  const theme = useTheme();
  const total = sum(segments);
  return (
    <View style={{ gap: 2 }}>
      <Text size="10" weight="semibold" color="muted" uppercase tracking={0.6} style={styles.legendTitle}>
        {`${half === 'top' ? '▲' : '▼'} ${title}`}
      </Text>
      {segments.map((s, i) => {
        const active = focus?.half === half && focus.key === s.key;
        return (
          <Animated.View
            key={s.key}
            entering={FadeInDown.duration(Duration.base)
              .delay(120 + (enterFrom + i) * 40)
              .easing(POP_EASE)}>
            <PressableScale
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${s.label}: ${s.value}`}
              scaleTo={0.98}
              haptic="select"
              onPress={() => onFocus(active ? null : { half, key: s.key })}
              style={[styles.legendRow, active && { backgroundColor: alpha(s.color, 0.16) }]}>
              <View style={[styles.legendDot, { backgroundColor: s.color }]} />
              <Text size="sm" weight={active ? 'semibold' : 'medium'} numberOfLines={1} style={{ flex: 1 }}>
                {s.label}
              </Text>
              <Text size="xs" color="muted" tabular style={{ width: 40, textAlign: 'right' }}>
                {`${pct(s.value, total)}%`}
              </Text>
              <Text size="sm" weight="semibold" tabular style={{ minWidth: 36, textAlign: 'right', color: theme.fg }}>
                {s.value}
              </Text>
            </PressableScale>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // No card: the ring sits straight on the page, centred.
  hero: { alignSelf: 'center', marginVertical: 6 },
  hint: { marginVertical: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centreSplit: { width: '30%', height: StyleSheet.hairlineWidth * 2, marginVertical: 6 },
  focusDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 4 },
  stage: { flex: 1, alignItems: 'center', paddingHorizontal: 16, gap: 16 },
  stageHead: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // No background: the ring floats on the dimmed screen, like the hero does on the page.
  focusRing: { alignItems: 'center', justifyContent: 'center' },
  legendCard: { alignSelf: 'stretch', borderRadius: Radius.xxxl + 6, borderWidth: 1, padding: 8, gap: 6 },
  legendTitle: { paddingHorizontal: 10, paddingTop: 4, paddingBottom: 2 },
  legendSplit: { height: StyleSheet.hairlineWidth * 2, marginHorizontal: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 38, paddingHorizontal: 10, borderRadius: 12 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
});
