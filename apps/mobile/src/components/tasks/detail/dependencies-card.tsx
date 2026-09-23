import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/motion/pressable-scale';
import { Panel, SectionLabel } from '@/components/page';
import { Text } from '@/components/text';
import { alpha, Radius, Tone } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import type { DependencyTaskRow } from '@/lib/task-detail-queries';

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  pending: { bg: alpha(Tone.slate500, 0.15), fg: Tone.slate500 },
  in_progress: { bg: alpha(Tone.blue500, 0.15), fg: Tone.blue500 },
  done: { bg: alpha(Tone.green500, 0.15), fg: Tone.green600 },
  cancelled: { bg: alpha(Tone.neutral500, 0.15), fg: Tone.neutral500 },
};

function StatusChip({ status }: { status: string }) {
  const dark = useIsDark();
  const tone = STATUS_TONE[status] ?? STATUS_TONE.pending!;
  const label = status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <View style={[styles.statusChip, { backgroundColor: tone.bg }]}>
      <Text size="10" weight="medium" color={dark ? tone.fg : tone.fg}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Dependencies card — read-only, mirroring the web's `TaskViewPanel` (which passes `canEdit={false}`;
 * adding/removing blockers lives only in the full editor page web has and mobile doesn't).
 */
export function DependenciesCard({
  blockers,
  blocking,
  onOpenTask,
}: {
  blockers: DependencyTaskRow[];
  blocking: DependencyTaskRow[];
  onOpenTask: (id: string) => void;
}) {
  const theme = useTheme();
  if (blockers.length === 0 && blocking.length === 0) return null;

  return (
    <Panel style={{ gap: 10 }}>
      <SectionLabel size="10">Dependencies</SectionLabel>
      {blockers.length > 0 ? (
        <View style={{ gap: 6 }}>
          <Text size="11" weight="medium" color="muted">
            Blocked by
          </Text>
          {blockers.map((b) => (
            <PressableScale key={b.id} style={[styles.row, { backgroundColor: theme.surfaceMuted }]} onPress={() => onOpenTask(b.id)}>
              <Text size="sm" numberOfLines={1} style={{ flex: 1 }}>
                {b.title}
              </Text>
              <StatusChip status={b.status} />
            </PressableScale>
          ))}
        </View>
      ) : null}
      {blocking.length > 0 ? (
        <View style={{ gap: 6 }}>
          <Text size="11" weight="medium" color="muted">
            Blocking
          </Text>
          {blocking.map((b) => (
            <PressableScale key={b.id} style={[styles.row, { backgroundColor: theme.surfaceMuted }]} onPress={() => onOpenTask(b.id)}>
              <Text size="sm" numberOfLines={1} style={{ flex: 1 }}>
                {b.title}
              </Text>
              <StatusChip status={b.status} />
            </PressableScale>
          ))}
        </View>
      ) : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: Radius.lg, paddingHorizontal: 10, paddingVertical: 8 },
  statusChip: { borderRadius: Radius.base, paddingHorizontal: 6, paddingVertical: 2 },
});
