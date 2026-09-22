import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/motion/pressable-scale';
import { Page, PageTitle, Panel } from '@/components/page';
import { StatusPill } from '@/components/tasks/status-pill';
import { Text } from '@/components/text';
import { IconButton } from '@/components/ui';
import { alpha, Radius, Tone } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { useActiveTasks } from '@/lib/queries';
import { formatDueForListPill } from '@/lib/format';
import { priorityColor, taskPriority } from '@/lib/task-board';
import type { TaskRow } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Calendar — a month grid of due dates, with the selected day's tasks underneath. */
export default function CalendarScreen() {
  const theme = useTheme();
  const dark = useIsDark();
  const { org } = useWorkspace();
  const active = useActiveTasks(org?.id);
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date>(today);

  const byDay = useMemo(() => {
    const m = new Map<string, TaskRow[]>();
    for (const t of active.data ?? []) {
      if (!t.dueAt) continue;
      const k = dayKey(new Date(t.dueAt));
      m.set(k, [...(m.get(k) ?? []), t]);
    }
    return m;
  }, [active.data]);

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const out: (Date | null)[] = Array(first.getDay()).fill(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (out.length % 7) out.push(null);
    return out;
  }, [cursor]);

  const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(cursor);
  const dayTasks = byDay.get(dayKey(selected)) ?? [];
  const shift = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));

  return (
    <Page gap={12} onRefresh={() => void active.refetch()} refreshing={active.isRefetching}>
      <PageTitle>Calendar</PageTitle>

      <Panel style={{ gap: 8 }}>
        <View style={styles.monthRow}>
          <IconButton icon={faChevronLeft} label="Previous month" onPress={() => shift(-1)} size={36} iconSize={14} />
          <Text size="sm" weight="semibold">
            {monthLabel}
          </Text>
          <IconButton icon={faChevronRight} label="Next month" onPress={() => shift(1)} size={36} iconSize={14} />
        </View>

        <View style={styles.grid}>
          {WEEKDAYS.map((w, i) => (
            <View key={i} style={styles.cell}>
              <Text size="11" weight="medium" color="muted">
                {w}
              </Text>
            </View>
          ))}
          {cells.map((d, i) => {
            if (!d) return <View key={`e${i}`} style={styles.cell} />;
            const tasks = byDay.get(dayKey(d)) ?? [];
            const isToday = dayKey(d) === dayKey(today);
            const isSel = dayKey(d) === dayKey(selected);
            return (
              <PressableScale scaleTo={0.97} key={i} style={styles.cell} onPress={() => setSelected(d)}>
                <View
                  style={[
                    styles.day,
                    isSel && { backgroundColor: theme.accent },
                    !isSel && isToday && { borderWidth: 1, borderColor: theme.accent },
                  ]}>
                  <Text size="13" weight={isToday || isSel ? 'semibold' : 'regular'} color={isSel ? theme.onAccent : theme.fg} tabular>
                    {d.getDate()}
                  </Text>
                </View>
                <View style={styles.dots}>
                  {tasks.slice(0, 3).map((t) => (
                    <View key={t.id} style={[styles.dot, { backgroundColor: priorityColor(taskPriority(t), dark, theme) === theme.muted ? alpha(Tone.blue500, 0.8) : priorityColor(taskPriority(t), dark, theme) }]} />
                  ))}
                </View>
              </PressableScale>
            );
          })}
        </View>
      </Panel>

      <View style={{ gap: 8 }}>
        <Text size="xs" weight="semibold" color="muted" uppercase tracking={0.5}>
          {new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(selected)}
        </Text>
        {dayTasks.length === 0 ? (
          <Text size="sm" color="muted">
            Nothing due.
          </Text>
        ) : (
          dayTasks.map((t) => (
            <PressableScale scaleTo={0.97}
              key={t.id}
              onPress={() => router.push({ pathname: '/task/[id]', params: { id: t.id } })}
              style={[styles.task, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle }]}>
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Text size="sm" weight="medium" numberOfLines={2}>
                  {t.title}
                </Text>
                <Text size="11" color="muted" tabular>
                  {t.dueAt ? formatDueForListPill(t.dueAt, org?.timeZone) : ''}
                </Text>
              </View>
              <StatusPill status={t.status} />
            </PressableScale>
          ))
        )}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4, minHeight: 46 },
  day: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 2, height: 6, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  task: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: Radius.xl, borderWidth: 1 },
});
