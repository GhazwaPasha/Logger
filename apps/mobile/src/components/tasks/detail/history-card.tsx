import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { LedgerLineBody } from '@/components/activity/ledger-line';
import { PressableScale } from '@/components/motion/pressable-scale';
import { RotatingChevron } from '@/components/motion/rotating-chevron';
import { Text } from '@/components/text';
import { revealIn, revealOut } from '@/constants/motion';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatLogTimestamp } from '@/lib/format';
import type { LedgerRow } from '@/lib/types';

/**
 * History card — a mobile port of the web's `TaskPanelHistoryCard`: collapsed by default, a
 * synthetic "created this task" line first, then every ledger entry oldest-first in monospace.
 */
export function HistoryCard({
  creatorName,
  taskId,
  ledger,
  names,
  timeZone,
}: {
  creatorName: string;
  taskId: string;
  ledger: LedgerRow[];
  names: Map<string, string>;
  timeZone: string;
}) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const entriesOldestFirst = [...ledger].reverse();

  return (
    <View style={[styles.card, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle }]}>
      <PressableScale
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={styles.header}
        onPress={() => setExpanded((v) => !v)}>
        <Text size="xs" weight="semibold" color="muted" uppercase tracking={0.5}>
          History
        </Text>
        <RotatingChevron open={expanded} icon={faChevronDown} openDeg={180} size={13} />
      </PressableScale>
      {expanded ? (
        <Animated.View entering={revealIn} exiting={revealOut} style={{ gap: 6, marginTop: 8 }}>
          <Text font="mono" size="11" lh={16} color="muted">
            <Text font="mono" size="11" lh={16} weight="medium" color="fg">
              {creatorName}
            </Text>{' '}
            created this task ·{' '}
            <Text font="mono" size="11" lh={16} color="muted" style={{ opacity: 0.7 }}>
              {taskId}
            </Text>
          </Text>
          {entriesOldestFirst.map((entry) => (
            <Text key={entry.id} font="mono" size="11" lh={16} color="muted">
              {formatLogTimestamp(entry.createdAt, timeZone)}
              {': '}
              <LedgerLineBody entry={entry} names={names} timeZone={timeZone} />
            </Text>
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.xl, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
