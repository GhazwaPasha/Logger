import { faClock, faSquareCheck, faSquareXmark, faUserClock } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { MenuSheet } from '@/components/menu-sheet';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Text } from '@/components/text';
import { stateTransition } from '@/constants/motion';
import { Radius } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import {
  FLOW_COLUMN_LABELS,
  normalizeTaskStatus,
  statusPillColors,
  storedStatusToFlowColumn,
  type ManualTaskStatus,
} from '@/lib/task-board';

export const STATUS_ICONS = {
  pending: faClock,
  in_progress: faUserClock,
  done: faSquareCheck,
  cancelled: faSquareXmark,
} as const;

/** The compact stage pill on task cards (`KanbanStatusPill` / `StatusPillSelect` on the web): 24px tall, 4px radius. */
export function StatusPill({
  status,
  options,
  onChange,
  pending,
}: {
  status: string;
  /** Stage targets offered in the menu; omit for a read-only pill. */
  options?: ManualTaskStatus[];
  onChange?: (next: ManualTaskStatus) => void;
  pending?: boolean;
}) {
  const theme = useTheme();
  const dark = useIsDark();
  const [open, setOpen] = useState(false);
  const stored = normalizeTaskStatus(status);
  const manual = storedStatusToFlowColumn(stored);
  const colors = statusPillColors(manual, dark, theme);
  const interactive = !!options && !!onChange && options.length > 1;

  return (
    <>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Task stage: ${FLOW_COLUMN_LABELS[manual]}`}
        disabled={!interactive || pending}
        onPress={() => setOpen(true)}
        scaleTo={0.95}
        style={[styles.pill, { backgroundColor: colors.bg, opacity: pending ? 0.88 : 1 }, stateTransition]}>
        {pending ? (
          <ActivityIndicator size="small" color={theme.muted} style={{ transform: [{ scale: 0.7 }] }} />
        ) : (
          <Text size="xs" weight="semibold" color={colors.fg} tracking={-0.2} lh={16} numberOfLines={1}>
            {FLOW_COLUMN_LABELS[manual]}
          </Text>
        )}
      </PressableScale>
      {interactive ? (
        <MenuSheet
          visible={open}
          title="Stage"
          value={manual}
          options={options.map((s) => ({ value: s, label: FLOW_COLUMN_LABELS[s], icon: STATUS_ICONS[s] }))}
          onSelect={(s) => s !== manual && onChange(s)}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

/** Column header chip on the kanban board (`statusPillPaletteClasses` tint + label + count). */
export function ColumnHeader({ status, count }: { status: ManualTaskStatus; count: string | number }) {
  const theme = useTheme();
  const dark = useIsDark();
  const colors = statusPillColors(status, dark, theme);
  return (
    <View style={[styles.column, { backgroundColor: colors.bg, borderColor: theme.borderSubtle }]}>
      <Text size="11" weight="semibold" color={colors.fg} tracking={-0.2} lh={11}>
        {FLOW_COLUMN_LABELS[status]}
      </Text>
      <Text size="10" weight="medium" color={colors.fg} tabular style={{ opacity: 0.8 }} lh={10}>
        {count}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 24,
    minWidth: 88,
    paddingHorizontal: 10,
    borderRadius: Radius.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  column: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
