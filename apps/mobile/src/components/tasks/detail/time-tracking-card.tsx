import { StyleSheet, View } from 'react-native';

import { Panel, SectionLabel } from '@/components/page';
import { Text } from '@/components/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { TimeEntryRow } from '@/lib/task-detail-queries';

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return `${sec}s`;
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
}

/**
 * Time tracking card — view-only, matching the web's `TimeTracker … viewOnly`: start/stop and
 * manual logging live only in the full editor page web has and mobile doesn't.
 */
export function TimeTrackingCard({ entries }: { entries: TimeEntryRow[] }) {
  const theme = useTheme();
  const completed = entries.filter((e) => e.stoppedAt);
  if (completed.length === 0) return null;

  const totalSeconds = completed.reduce((acc, e) => acc + (e.duration ? parseInt(e.duration, 10) : 0), 0);

  return (
    <Panel style={{ gap: 8 }}>
      <View style={styles.head}>
        <SectionLabel size="10">Time Tracking</SectionLabel>
        <Text size="xs" weight="semibold">
          {formatDuration(totalSeconds)} total
        </Text>
      </View>
      {completed.map((e) => (
        <View key={e.id} style={[styles.row, { backgroundColor: theme.surfaceMuted }]}>
          <View style={styles.rowHead}>
            <Text size="xs" weight="medium">
              {e.userName}
            </Text>
            <Text size="xs" color="muted">
              {formatDuration(parseInt(e.duration ?? '0', 10))}
            </Text>
          </View>
          <Text size="xs" color="muted">
            {formatDateTime(e.startedAt)}
          </Text>
          {e.note ? (
            <Text size="xs" color="muted" style={{ fontStyle: 'italic', marginTop: 2 }}>
              {e.note}
            </Text>
          ) : null}
        </View>
      ))}
    </Panel>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { borderRadius: Radius.lg, paddingHorizontal: 10, paddingVertical: 8 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
