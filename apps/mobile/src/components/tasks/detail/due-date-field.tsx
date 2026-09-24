import { faCalendarDays, faClock, faXmark } from '@fortawesome/free-solid-svg-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion/pressable-scale';
import { usePresence } from '@/components/motion/use-presence';
import { Panel, SectionLabel } from '@/components/page';
import { Text } from '@/components/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { TaskDueRepeat } from '@/lib/types';

const REPEAT_OPTIONS: { value: TaskDueRepeat; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];
export const REPEAT_LABEL: Record<TaskDueRepeat, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };

function formatTrigger(d: Date | null): string {
  if (!d) return 'Set due';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
}

function formatFull(d: Date): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

/** Due date + recurrence card — a mobile port of the web's `DueDateTimePopover` + `DueRepeatPopover`. */
export function DueDateFieldCard({
  dueAt,
  dueRepeat,
  canEdit,
  dueColor,
  onChangeDue,
  onChangeDueRepeat,
}: {
  dueAt: string | null;
  dueRepeat: TaskDueRepeat | null;
  canEdit: boolean;
  /** Color for the read-only label (overdue → red, upcoming → normal, etc). */
  dueColor?: string;
  onChangeDue: (iso: string | null) => void;
  onChangeDueRepeat: (repeat: TaskDueRepeat | null) => void;
}) {
  const theme = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const due = dueAt ? new Date(dueAt) : null;

  if (!canEdit) {
    return (
      <Panel style={{ gap: 4 }}>
        <SectionLabel size="10">Due date</SectionLabel>
        {due ? (
          <>
            <Text size="sm" weight="medium" color={dueColor ?? 'fg'}>
              {formatFull(due)}
            </Text>
            {dueRepeat ? (
              <Text size="xs" color="muted">
                Repeats {REPEAT_LABEL[dueRepeat]}
              </Text>
            ) : null}
          </>
        ) : (
          <Text size="sm" color="muted">
            No due date
          </Text>
        )}
      </Panel>
    );
  }

  return (
    <Panel style={{ gap: 8 }}>
      <SectionLabel size="10">Due date</SectionLabel>
      <View style={styles.row}>
        <PressableScale
          style={[styles.trigger, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle }]}
          onPress={() => setSheetOpen(true)}>
          <Icon icon={faCalendarDays} size={13} color={dueColor ?? 'muted'} />
          <Text size="sm" weight="medium" color={dueColor ?? 'fg'}>
            {formatTrigger(due)}
          </Text>
        </PressableScale>
        {due ? (
          <PressableScale
            style={[styles.trigger, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle, opacity: dueRepeat ? 1 : 0.6 }]}
            onPress={() => setSheetOpen(true)}>
            <Text size="sm" weight="medium" color="muted">
              {dueRepeat ? REPEAT_LABEL[dueRepeat] : 'Repeat'}
            </Text>
          </PressableScale>
        ) : null}
      </View>

      <DueDateSheet
        visible={sheetOpen}
        due={due}
        dueRepeat={dueRepeat}
        onClose={() => setSheetOpen(false)}
        onChangeDue={onChangeDue}
        onChangeDueRepeat={onChangeDueRepeat}
      />
    </Panel>
  );
}

export function DueDateSheet({
  visible,
  due,
  dueRepeat,
  onClose,
  onChangeDue,
  onChangeDueRepeat,
}: {
  visible: boolean;
  due: Date | null;
  dueRepeat: TaskDueRepeat | null;
  onClose: () => void;
  onChangeDue: (iso: string | null) => void;
  onChangeDueRepeat: (repeat: TaskDueRepeat | null) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { mounted, progress } = usePresence(visible, { spring: true });
  const [iosPicker, setIosPicker] = useState<'date' | 'time' | null>(null);

  const backdrop = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, progress.value)) }));
  const sheet = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, progress.value));
    return { opacity: p, transform: [{ translateY: (1 - p) * height * 0.4 }] };
  });

  const commit = (next: Date) => onChangeDue(next.toISOString());

  const openAndroidDate = () => {
    DateTimePickerAndroid.open({
      value: due ?? new Date(),
      mode: 'date',
      onChange: (e, selected) => {
        if (e.type !== 'set' || !selected) return;
        const next = new Date(selected);
        if (due) next.setHours(due.getHours(), due.getMinutes());
        DateTimePickerAndroid.open({
          value: next,
          mode: 'time',
          onChange: (e2, timeSelected) => {
            if (e2.type !== 'set' || !timeSelected) return;
            const final = new Date(next);
            final.setHours(timeSelected.getHours(), timeSelected.getMinutes());
            commit(final);
          },
        });
      },
    });
  };

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }, backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View pointerEvents="box-none" style={[styles.anchor, sheet]}>
        <Pressable
          onPress={() => {}}
          style={[styles.sheet, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle, paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Text size="11" weight="semibold" color="muted" uppercase tracking={0.8} style={{ paddingHorizontal: 4, paddingBottom: 4 }}>
            Due date
          </Text>

          {Platform.OS === 'android' ? (
            <PressableScale
              style={[styles.field, { backgroundColor: theme.surfaceMuted }]}
              onPress={openAndroidDate}>
              <Icon icon={faCalendarDays} size={14} color="muted" />
              <Text size="sm" weight="medium" style={{ flex: 1 }}>
                {due ? formatFull(due) : 'Tap to choose date & time'}
              </Text>
            </PressableScale>
          ) : (
            <>
              <PressableScale
                style={[styles.field, { backgroundColor: theme.surfaceMuted }]}
                onPress={() => setIosPicker(iosPicker === 'date' ? null : 'date')}>
                <Icon icon={faCalendarDays} size={14} color="muted" />
                <Text size="sm" weight="medium" style={{ flex: 1 }}>
                  {due ? formatFull(due) : 'Tap to choose date'}
                </Text>
              </PressableScale>
              {iosPicker === 'date' ? (
                <DateTimePicker
                  value={due ?? new Date()}
                  mode="date"
                  display="spinner"
                  onChange={(_e, selected) => {
                    if (!selected) return;
                    const next = due ? new Date(due) : new Date();
                    next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
                    commit(next);
                  }}
                />
              ) : null}
              <PressableScale
                style={[styles.field, { backgroundColor: theme.surfaceMuted }]}
                onPress={() => setIosPicker(iosPicker === 'time' ? null : 'time')}>
                <Icon icon={faClock} size={14} color="muted" />
                <Text size="sm" weight="medium" style={{ flex: 1 }}>
                  {due ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(due) : 'Tap to choose time'}
                </Text>
              </PressableScale>
              {iosPicker === 'time' ? (
                <DateTimePicker
                  value={due ?? new Date()}
                  mode="time"
                  display="spinner"
                  onChange={(_e, selected) => {
                    if (!selected) return;
                    const next = due ? new Date(due) : new Date();
                    next.setHours(selected.getHours(), selected.getMinutes());
                    commit(next);
                  }}
                />
              ) : null}
            </>
          )}

          {due ? (
            <PressableScale
              style={styles.clearBtn}
              onPress={() => {
                onChangeDue(null);
                onChangeDueRepeat(null);
                onClose();
              }}>
              <Icon icon={faXmark} size={12} color="muted" />
              <Text size="xs" weight="medium" color="muted">
                Clear due date
              </Text>
            </PressableScale>
          ) : null}

          <Text size="11" weight="semibold" color="muted" uppercase tracking={0.8} style={{ paddingHorizontal: 4, paddingTop: 10, paddingBottom: 4 }}>
            Repeat
          </Text>
          <View style={styles.repeatGrid}>
            {REPEAT_OPTIONS.map((o) => {
              const active = dueRepeat === o.value;
              return (
                <PressableScale
                  key={o.value}
                  disabled={!due}
                  style={[
                    styles.repeatOption,
                    active
                      ? { borderColor: theme.accent, backgroundColor: theme.accentMuted }
                      : { borderColor: theme.borderSubtle, backgroundColor: theme.surfaceElevated },
                    !due && { opacity: 0.4 },
                  ]}
                  onPress={() => onChangeDueRepeat(active ? null : o.value)}>
                  <Text size="xs" weight="medium" color={active ? 'fg' : 'muted'}>
                    {o.label}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.lg, borderWidth: 1 },
  anchor: { flex: 1, justifyContent: 'flex-end' },
  sheet: { padding: 12, borderTopLeftRadius: Radius.xxxl, borderTopRightRadius: Radius.xxxl, borderWidth: StyleSheet.hairlineWidth * 2, gap: 6 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: Radius.lg, paddingHorizontal: 12, paddingVertical: 10 },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 4, paddingVertical: 6 },
  repeatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  repeatOption: { flexBasis: '47%', flexGrow: 1, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.md, borderWidth: 1 },
});
