import { useEffect, type ReactNode } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { LedgerLineBody, ledgerEntryLate } from '@/components/activity/ledger-line';
import { Text } from '@/components/text';
import { alpha, Radius, Tone } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { formatLogTimestamp } from '@/lib/format';
import type { LedgerRow } from '@/lib/types';

/** The feed's own accent — a terminal reads as "live" through one consistent colour, not the app's palette. */
const LIVE = Tone.emerald500;

/** How long each line takes to wipe in — and, since lines queue one after another, the gap between their starts. */
const LINE_SWEEP_MS = 160;
/** Lines past this position in a batch all start at the same delay, so a long log doesn't take forever to finish typing in. */
const LINE_SWEEP_CAP = 20;

/** Standing status line's phrase — a coding agent's spinner stays on one line too, not a rotating ticker. */
const PULSE_WORD = 'Watching for activity';

/** Shown as line one while the feed's first page is still in flight, so the sequence has something to type in before real entries land. */
const PREPARING_WORD = 'Preparing your logs';

/** Spinning, pulsing glyph — the standing line's "working" indicator (a coding agent's spinner, in miniature). */
function PulseGlyph() {
  const spin = useSharedValue(0);
  const fade = useSharedValue(1);
  useEffect(() => {
    spin.value = withRepeat(withTiming(360, { duration: 2600, easing: Easing.linear }), -1);
    fade.value = withRepeat(withTiming(0.45, { duration: 650, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => {
      cancelAnimation(spin);
      cancelAnimation(fade);
    };
  }, [spin, fade]);
  const style = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ rotate: `${spin.value}deg` }] }));
  return <Animated.Text style={[styles.glyph, { color: LIVE }, style]}>✳</Animated.Text>;
}

/**
 * Standing line pinned above the log: a spinning glyph next to a status phrase — so the feed reads as live
 * and working even between entries, the way a coding agent's own spinner ("Thinking…") stays on screen. It
 * types in first, as line zero of the print-out the entries below continue.
 */
function PulseLine() {
  return (
    <View style={styles.pulseRow}>
      <PulseGlyph />
      <TypeReveal delay={0}>
        <Text font="mono" size="xs" lh={16} color="muted" tracking={0.2}>
          {PULSE_WORD}…
        </Text>
      </TypeReveal>
    </View>
  );
}

/** Red "Late" pill — the web's `LateBadge`, as a trailing sibling since RN can't inline a View in Text. */
function LateBadge() {
  const dark = useIsDark();
  return (
    <View style={[styles.lateBadge, { backgroundColor: alpha(Tone.red500, 0.15) }]}>
      <Text size="10" weight="semibold" uppercase tracking={0.4} color={dark ? Tone.red400 : Tone.red600}>
        Late
      </Text>
    </View>
  );
}

/**
 * Wipes its child in left-to-right over the page's own background, like text being typed onto a terminal —
 * the RN equivalent of the web's `clip-path` reveal, since clip-path animation isn't available here. `delay`
 * holds the wipe off until the line before it has fully typed in, so a batch of lines queues one at a time
 * instead of all sweeping in together.
 */
function TypeReveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const theme = useTheme();
  const width = useSharedValue(0);
  const progress = useSharedValue(0);
  // Before the first layout pass, the mask's pixel width is unknown — stretching it edge-to-edge (rather
  // than leaving it at a 0px width) keeps the text covered from the very first frame, so measuring doesn't
  // make it flash visible and then snap back under a mask the instant layout lands.
  const measured = useSharedValue(false);

  const onLayout = (e: LayoutChangeEvent) => {
    if (width.value > 0) return;
    width.value = e.nativeEvent.layout.width;
    measured.value = true;
    progress.value = withDelay(delay, withTiming(1, { duration: LINE_SWEEP_MS, easing: Easing.out(Easing.cubic) }));
  };

  // Only ever drives `width` — `right: 0` is set once, statically, in `styles.revealMask`, and never
  // toggled between frames. Flipping `left`/`right` between renders (what this used to do) left a stale
  // `left: 0` from the pre-measurement frame in place on the native side once `right` took over, which
  // over-constrained the box and anchored the shrink from the wrong edge.
  const maskStyle = useAnimatedStyle(() => ({ width: measured.value ? width.value * (1 - progress.value) : 2000 }));

  return (
    <View onLayout={onLayout} style={styles.revealWrap}>
      {children}
      <Animated.View pointerEvents="none" style={[styles.revealMask, { backgroundColor: theme.surfaceBase }, maskStyle]} />
    </View>
  );
}

/**
 * The workspace's activity feed as a terminal print-out: plain monospace lines laid straight on the page, no
 * card or background of their own — the screen under the Activity tab reads as the terminal, not a widget
 * sitting on it. The standing "working" line and every entry type in left-to-right, one at a time, each
 * queued to start only once the line before it has finished — a print-out, not a wall of text sliding in.
 */
export function ActivityTerminal({
  entries,
  tasksById,
  names,
  timeZone,
  isLoading,
  loadingMore,
  errorMessage,
  onOpenTask,
}: {
  entries: (LedgerRow & { taskId: string })[];
  tasksById: Record<string, { title: string; dueAt?: string | null }>;
  names: Map<string, string>;
  timeZone: string;
  isLoading: boolean;
  /** A background page fetch for older entries is in flight (distinct from the initial `isLoading`). */
  loadingMore?: boolean;
  errorMessage?: string | null;
  onOpenTask: (taskId: string) => void;
}) {
  const dark = useIsDark();

  if (errorMessage) {
    return (
      <Text font="mono" size="sm" color={dark ? Tone.red400 : Tone.red600}>
        {errorMessage}
      </Text>
    );
  }

  return (
    <View style={styles.list}>
      <PulseLine />
      {isLoading ? (
        <TypeReveal delay={LINE_SWEEP_MS}>
          <Text font="mono" size="sm" color="muted">
            {PREPARING_WORD}…
          </Text>
        </TypeReveal>
      ) : entries.length === 0 ? (
        <TypeReveal delay={LINE_SWEEP_MS}>
          <Text font="mono" size="sm" color="muted">
            No activity logged yet for tasks you can access in this workspace.
          </Text>
        </TypeReveal>
      ) : (
        entries.map((entry, i) => {
          const meta = tasksById[entry.taskId];
          const title = meta?.title ?? entry.taskId;
          const late = ledgerEntryLate(entry, meta?.dueAt ?? null);
          // +1 queues every entry behind the standing line (line 0); capped so a long log still finishes typing
          // in a reasonable time instead of queuing one line every 160ms all the way down.
          const delay = (Math.min(i, LINE_SWEEP_CAP - 1) + 1) * LINE_SWEEP_MS;
          const line = (
            <Text font="mono" size="xs" lh={18} color="muted" style={styles.lineText}>
              {formatLogTimestamp(entry.createdAt, timeZone)}
              {': '}
              <Text font="mono" size="xs" lh={18} weight="bold" color="fg" onPress={() => onOpenTask(entry.taskId)}>
                {title}
              </Text>
              {' · '}
              <LedgerLineBody entry={entry} names={names} timeZone={timeZone} />
            </Text>
          );
          return (
            <View key={entry.id} style={styles.lineRow}>
              <TypeReveal delay={delay}>{line}</TypeReveal>
              {late ? <LateBadge /> : null}
            </View>
          );
        })
      )}
      {loadingMore ? (
        <View style={styles.pulseRow}>
          <PulseGlyph />
          <Text font="mono" size="11" lh={16} color="muted" tracking={0.2}>
            Loading earlier activity…
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 6 },
  pulseRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  glyph: { fontSize: 13, lineHeight: 16 },
  lineRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6, rowGap: 2 },
  lineText: { flexShrink: 1 },
  revealWrap: { position: 'relative', flexShrink: 1 },
  revealMask: { position: 'absolute', top: 0, bottom: 0, right: 0 },
  lateBadge: { borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 2 },
});
