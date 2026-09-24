import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { LedgerLineBody, ledgerEntryLate } from '@/components/activity/ledger-line';
import { Pulse } from '@/components/motion/pulse';
import { Text } from '@/components/text';
import { alpha, Radius, Tone } from '@/constants/theme';
import { revealIn } from '@/constants/motion';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { formatLogTimestamp } from '@/lib/format';
import type { LedgerRow } from '@/lib/types';

/** Entries younger than this are freshly rendered (matches the web's "live" reveal window). */
const LIVE_ENTRY_WINDOW_MS = 2 * 60 * 1000;

/** Cap on rendered rows — the web scrolls its own bounded box; mobile relies on the page scroll instead. */
const ENTRY_CAP = 120;

function TerminalChrome({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.terminal, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle }]}>
      <View style={[styles.bar, { backgroundColor: theme.surfaceMuted, borderBottomColor: theme.borderSubtle }]}>
        <Text font="mono" size="10" color="muted" tracking={0.3}>
          activity.log
        </Text>
      </View>
      <View>{children}</View>
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

export function ActivityTerminal({
  entries,
  tasksById,
  names,
  timeZone,
  isLoading,
  errorMessage,
  onOpenTask,
}: {
  entries: (LedgerRow & { taskId: string })[];
  tasksById: Record<string, { title: string; dueAt?: string | null }>;
  names: Map<string, string>;
  timeZone: string;
  isLoading: boolean;
  errorMessage?: string | null;
  onOpenTask: (taskId: string) => void;
}) {
  const theme = useTheme();
  const dark = useIsDark();
  // Dynamic cap so the box scrolls once it's eaten most of the screen, instead of a fixed pixel
  // height (too cramped on tall screens) or growing unbounded (swallows the whole page) — the same
  // idea as the web's `max-h-[min(Nvh,Nrem)]`.
  const { height: windowHeight } = useWindowDimensions();
  const maxHeight = Math.min(windowHeight * 0.85, 640);
  // Snapshot "now" after mount (not during render) so the recency check stays pure; re-snapshots
  // whenever entries change so freshly-arrived rows get their reveal animation.
  const [now, setNow] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
  }, [entries]);

  if (errorMessage) {
    return (
      <TerminalChrome>
        <Text size="sm" color={dark ? Tone.red400 : Tone.red600} style={styles.pad}>
          {errorMessage}
        </Text>
      </TerminalChrome>
    );
  }

  if (isLoading) {
    return (
      <TerminalChrome>
        <View style={[styles.pad, { gap: 8 }]}>
          {[75, 52, 68, 45, 60, 40, 55].map((w, i) => (
            <Pulse key={i} style={{ height: 10, width: `${w}%`, borderRadius: 3, backgroundColor: theme.surfaceHover }} />
          ))}
        </View>
      </TerminalChrome>
    );
  }

  if (entries.length === 0) {
    return (
      <TerminalChrome>
        <View style={styles.pad}>
          <Text size="sm" color="muted">
            No activity logged yet for tasks you can access in this workspace.
          </Text>
        </View>
      </TerminalChrome>
    );
  }

  return (
    <TerminalChrome>
      <ScrollView
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight }}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}>
        {entries.slice(0, ENTRY_CAP).map((entry) => {
          const meta = tasksById[entry.taskId];
          const title = meta?.title ?? entry.taskId;
          const late = ledgerEntryLate(entry, meta?.dueAt ?? null);
          const isLive = now - new Date(entry.createdAt).getTime() < LIVE_ENTRY_WINDOW_MS;
          return (
            <Animated.View key={entry.id} entering={isLive ? revealIn : undefined} style={styles.lineRow}>
              <Text font="mono" size="11" lh={16} color="muted" style={styles.lineText}>
                {formatLogTimestamp(entry.createdAt, timeZone)}
                {': '}
                <Text font="mono" size="11" lh={16} weight="bold" color="fg" onPress={() => onOpenTask(entry.taskId)}>
                  {title}
                </Text>
                {' · '}
                <LedgerLineBody entry={entry} names={names} timeZone={timeZone} />
              </Text>
              {late ? <LateBadge /> : null}
            </Animated.View>
          );
        })}
      </ScrollView>
    </TerminalChrome>
  );
}

const styles = StyleSheet.create({
  terminal: { borderRadius: Radius.xl, borderWidth: 1, overflow: 'hidden' },
  bar: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  pad: { padding: 12 },
  list: { padding: 10, gap: 6 },
  lineRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6, rowGap: 2 },
  lineText: { flexShrink: 1 },
  lateBadge: { borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 2 },
});
