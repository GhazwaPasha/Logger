import { ArrowUpIcon, BellIcon, CalendarPlusIcon, CheckIcon, ChevronsDownIcon, ChevronsUpIcon, EllipsisVerticalIcon, PaperclipIcon, PlusIcon, RepeatIcon, TimerIcon, UserPlusIcon } from 'lucide-react-native';
import { faDiscord } from '@fortawesome/free-brands-svg-icons';
import { memo, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { LedgerLineBody } from '@/components/activity/ledger-line';
import { Icon } from '@/components/icon';
import { MenuSheet } from '@/components/menu-sheet';
import { Pulse } from '@/components/motion/pulse';
import { PressableScale } from '@/components/motion/pressable-scale';
import { RotatingChevron } from '@/components/motion/rotating-chevron';
import { SyncRibbon } from '@/components/motion/sync-ribbon';
import { useBoardActions } from '@/components/tasks/board-context';
import { StatusPill } from '@/components/tasks/status-pill';
import { Text } from '@/components/text';
import { Avatar } from '@/components/ui';
import { Duration, cardEnter, listLayout, POP_EASE, revealIn, revealOut, stateTransition } from '@/constants/motion';
import { alpha, elevation, Radius } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { formatDueForListPill, formatLogTimestamp } from '@/lib/format';
import { taskEditCaps } from '@/lib/permissions';
import {
  dueChipColors,
  nextWorkflowManualStatus,
  normalizeTaskStatus,
  PRIORITIES,
  PRIORITY_LABELS,
  priorityColor,
  stageControlDropdownOptions,
  storedStatusToFlowColumn,
  taskPriority,
  taskShowsLateFooter,
  type TaskPriority,
} from '@/lib/task-board';
import type { SubtaskRow, TaskRow } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';

/** Max checklist rows on a kanban card before "+N more" (`KANBAN_CARD_SUBTASK_PREVIEW`). */
const KANBAN_SUBTASK_PREVIEW = 8;

/**
 * The web card's checkboxes: the task's is a 22dp circle that fills green when done; a subtask's is a 16dp
 * rounded square that fills blue. Unchecked, both are a hollow ring in `ink3`.
 */
function Checkbox({
  checked,
  busy,
  disabled,
  onPress,
  label,
  kind,
}: {
  checked: boolean;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
  label: string;
  kind: 'task' | 'subtask';
}) {
  const theme = useTheme();
  const task = kind === 'task';
  const size = task ? 22 : 16;
  const fill = task ? theme.statusDone : theme.infoInk;
  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled: !!disabled, busy: !!busy }}
      disabled={disabled || busy}
      hitSlop={10}
      scaleTo={0.86}
      haptic="select"
      onPress={onPress}
      style={[
        styles.checkbox,
        { width: size, height: size, borderRadius: task ? size / 2 : 5, borderWidth: checked ? 0 : 1.5 },
        checked ? { backgroundColor: fill } : { backgroundColor: 'transparent', borderColor: theme.ink3 },
        (disabled || busy) && { opacity: 0.4 },
        stateTransition,
      ]}>
      {busy ? (
        <ActivityIndicator size="small" color={theme.muted} style={{ transform: [{ scale: 0.55 }] }} />
      ) : checked ? (
        <Animated.View entering={ZoomIn.duration(Duration.micro).easing(POP_EASE)}>
          <Icon icon={CheckIcon} size={task ? 13 : 10} color="#FFFFFF" strokeWidth={3} />
        </Animated.View>
      ) : null}
    </PressableScale>
  );
}

/** Small ring that fills as subtasks get done (web `SubtaskRing`): blue while in progress, green when all done. */
function SubtaskRing({ done, total }: { done: number; total: number }) {
  const theme = useTheme();
  const r = 7;
  const c = 2 * Math.PI * r;
  const frac = total > 0 ? done / total : 0;
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={9} cy={9} r={r} fill="none" strokeWidth={2.4} stroke={theme.fill2} />
      {frac > 0 ? (
        <Circle
          cx={9}
          cy={9}
          r={r}
          fill="none"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeDasharray={`${frac * c} ${c}`}
          stroke={frac === 1 ? theme.statusDone : theme.infoInk}
        />
      ) : null}
    </Svg>
  );
}

/** Card footer: the task's latest activity in the ledger's mono face (web `TaskCardLastActivity`). */
function LastActivity({ task }: { task: TaskRow }) {
  const theme = useTheme();
  const { members } = useWorkspace();
  const { timeZone } = useBoardActions();
  const names = useMemo(() => new Map(members.map((m) => [m.userId, (m.name ?? '').trim() || m.email])), [members]);
  const entry = task.lastLedger;
  if (!entry) return null;
  return (
    <View style={[styles.footer, { borderTopColor: alpha(theme.line, 0.6) }]} accessibilityLabel="Last activity">
      <Text font="mono" size="11" lh={16} color="muted" numberOfLines={2} style={{ flex: 1 }}>
        {`${formatLogTimestamp(entry.createdAt, timeZone)}: `}
        <LedgerLineBody entry={entry} names={names} timeZone={timeZone} />
      </Text>
    </View>
  );
}

function SubtaskRows({
  task,
  subtasks,
  overflow,
}: {
  task: TaskRow;
  subtasks: SubtaskRow[];
  overflow?: number;
}) {
  const theme = useTheme();
  const { setSubtaskDone, openTask } = useBoardActions();
  return (
    <Animated.View entering={revealIn} exiting={revealOut} style={styles.subtasks}>
      {subtasks.map((s) => (
        <View key={s.id} style={styles.subtaskRow}>
          <View style={{ marginTop: 2 }}>
            <Checkbox
              kind="subtask"
              checked={s.done}
              label={s.done ? 'Mark subtask not done' : 'Mark subtask done'}
              onPress={() => setSubtaskDone(task.id, s.id, !s.done)}
            />
          </View>
          <Text
            size="13"
            lh={18}
            color={s.done ? 'muted' : 'fg'}
            style={[{ flex: 1 }, s.done && { textDecorationLine: 'line-through', textDecorationColor: theme.muted }]}>
            {s.title}
          </Text>
        </View>
      ))}
      {overflow ? (
        <Text size="11" color="muted" style={{ paddingTop: 2 }}>
          +{overflow} more —{' '}
          <Text size="11" weight="medium" color="accent" onPress={() => openTask(task.id)}>
            open task
          </Text>
        </Text>
      ) : null}
    </Animated.View>
  );
}

function TaskCardImpl({
  task,
  variant,
  enterIndex,
}: {
  task: TaskRow;
  variant: 'list' | 'kanban';
  /** Position in the list, for the staggered entrance; omit for no entrance animation. */
  enterIndex?: number;
}) {
  const theme = useTheme();
  const dark = useIsDark();
  const { openTask, patchTask, syncingIds, timeZone } = useBoardActions();
  const { members, lists, userId } = useWorkspace();
  const [expanded, setExpanded] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);

  const kanban = variant === 'kanban';
  const syncing = syncingIds.has(task.id);
  const stored = normalizeTaskStatus(task.status);
  const flowCol = storedStatusToFlowColumn(stored);
  const done = flowCol === 'done';
  const cancelled = flowCol === 'cancelled';
  const advanceTo = nextWorkflowManualStatus(stored);
  const canEdit = taskEditCaps(task, lists, userId, members).canEditFields;
  const priority = taskPriority(task);
  const late = taskShowsLateFooter(task);
  const due = dueChipColors(task, dark, theme);

  const assignee = members.find((m) => m.userId === task.assigneeUserIds?.[0]);
  const subtasks = task.subtasks ?? [];
  const subtasksDone = subtasks.filter((s) => s.done).length;
  const subtaskShown = kanban ? subtasks.slice(0, KANBAN_SUBTASK_PREVIEW) : expanded ? subtasks : [];
  const subtaskOverflow = kanban && subtasks.length > KANBAN_SUBTASK_PREVIEW ? subtasks.length - KANBAN_SUBTASK_PREVIEW : 0;

  const titleColor = cancelled || done ? 'muted' : 'fg';
  const titleDecoration = cancelled
    ? ({ textDecorationLine: 'line-through', textDecorationColor: theme.danger } as const)
    : done
      ? ({ textDecorationLine: 'line-through', textDecorationColor: theme.muted } as const)
      : null;

  const PriorityIcon = priority === 'high' ? ChevronsUpIcon : priority === 'low' ? ChevronsDownIcon : ArrowUpIcon;
  const pColor = priorityColor(priority, dark, theme);
  const dueLabel = task.dueAt ? formatDueForListPill(task.dueAt, timeZone) : null;

  return (
    <Animated.View
      // In the list, the FlatList's itemLayoutAnimation moves rows; a second layout animation here could park a
      // row at a stale offset (cards overlapping). The kanban column is a plain stack, so it animates here.
      layout={kanban ? listLayout : undefined}
      entering={enterIndex === undefined ? undefined : cardEnter(enterIndex)}
      style={[
        styles.card,
        // Web card: card fill + hairline/soft shadow, no border; a syncing card lifts to the raised shadow.
        { backgroundColor: syncing ? theme.cardRaised : theme.card, ...elevation(theme, syncing ? 'raised' : 'card') },
      ]}>
      {syncing ? <SyncRibbon /> : null}
      <View style={kanban ? styles.kanbanBody : undefined}>
        {/* Header: [round checkbox] title · status · overflow (web list card) */}
        <View style={[styles.header, kanban ? styles.headerKanban : styles.headerList]}>
          {!kanban ? (
            <Checkbox
              kind="task"
              checked={done}
              busy={syncing}
              disabled={cancelled || (!done && advanceTo == null)}
              label={
                cancelled
                  ? 'Task cancelled'
                  : done
                    ? 'Mark task not done'
                    : advanceTo
                      ? `Confirm advancing task to ${advanceTo}`
                      : 'Cannot advance task'
              }
              onPress={() => {
                if (done) patchTask(task.id, { status: 'in_progress' });
                else if (advanceTo) patchTask(task.id, { status: advanceTo });
              }}
            />
          ) : null}

          <PressableScale
            scaleTo={0.995}
            style={({ pressed }) => [{ flex: 1, minWidth: 0 }, pressed && { opacity: 0.6 }]}
            onPress={() => openTask(task.id)}
            accessibilityRole="link">
            <Text
              size="15"
              lh={21}
              weight="semibold"
              tracking={-0.2}
              color={titleColor}
              numberOfLines={kanban ? 3 : 2}
              style={titleDecoration}>
              {task.title}
            </Text>
          </PressableScale>

          <View style={styles.headerRight}>
            {task.dueRepeat ? (
              <View accessible accessibilityLabel={`Repeats ${task.dueRepeat}`} style={styles.repeatMark}>
                <Icon icon={RepeatIcon} size={14} color="muted" />
              </View>
            ) : null}
            <StatusPill
              status={task.status}
              options={stageControlDropdownOptions(stored, canEdit)}
              onChange={(next) => patchTask(task.id, { status: next })}
              pending={syncing}
            />
            <PressableScale scaleTo={0.92}
              accessibilityRole="button"
              accessibilityLabel={`More options — edit: ${task.title}`}
              hitSlop={6}
              onPress={() => openTask(task.id)}
              style={styles.overflow}>
              <Icon icon={EllipsisVerticalIcon} size={20} color="muted" style={{ opacity: 0.55 }} />
            </PressableScale>
          </View>
        </View>

        {/* Subtasks + meta row, indented under the title like the web list card */}
        <View style={kanban ? { paddingTop: 4 } : styles.bodyList}>
          <View style={styles.metaRow}>
            <PressableScale scaleTo={0.94}
              accessibilityRole="button"
              accessibilityLabel={subtasks.length ? `Subtasks: ${subtasksDone} of ${subtasks.length} done` : 'Add subtasks'}
              onPress={() => (kanban || subtasks.length === 0 ? openTask(task.id) : setExpanded((v) => !v))}
              hitSlop={6}
              style={({ pressed }) => [styles.subtasksToggle, pressed && { backgroundColor: theme.fill }]}>
              {subtasks.length > 0 ? (
                <>
                  <SubtaskRing done={subtasksDone} total={subtasks.length} />
                  <Text size="13" weight="medium" color="muted" tabular>
                    {`${subtasksDone} of ${subtasks.length}`}
                  </Text>
                  {!kanban ? <RotatingChevron open={expanded} size={14} /> : null}
                </>
              ) : (
                <>
                  <Text size="13" weight="medium" color="muted">
                    Subtasks
                  </Text>
                  <Icon icon={PlusIcon} size={18} color="muted" style={{ opacity: 0.6 }} />
                </>
              )}
            </PressableScale>

            <View style={{ flex: 1 }} />

            <View style={styles.icons}>
              <PressableScale scaleTo={0.92}
                accessibilityLabel={assignee ? `Assignee: ${assignee.name || assignee.email}` : 'No assignee'}
                hitSlop={6}
                onPress={() => openTask(task.id)}
                style={styles.iconSlot}>
                {assignee ? (
                  <Avatar name={assignee.name} email={assignee.email} image={assignee.image} size={20} tint={theme.fill2} />
                ) : (
                  <Icon icon={UserPlusIcon} size={18} color="muted" style={{ opacity: 0.8 }} />
                )}
              </PressableScale>

              <PressableScale scaleTo={0.92}
                accessibilityLabel={dueLabel ? `Due ${dueLabel}${late ? ' — Overdue' : ''}` : 'No due date'}
                hitSlop={6}
                onPress={() => openTask(task.id)}
                style={[styles.dueChip, { backgroundColor: due.bg, borderColor: due.border }]}>
                <Icon icon={late ? BellIcon : task.dueAt ? TimerIcon : CalendarPlusIcon} size={16} color={due.fg} />
                {dueLabel ? (
                  <Text size="xs" weight="medium" color={due.fg} tabular lh={12} numberOfLines={1} style={{ flexShrink: 1 }}>
                    {dueLabel}
                  </Text>
                ) : null}
              </PressableScale>

              <PressableScale scaleTo={0.92}
                accessibilityLabel={`Priority: ${PRIORITY_LABELS[priority]}`}
                hitSlop={6}
                disabled={!canEdit || syncing}
                onPress={() => setPriorityOpen(true)}
                style={styles.iconSlot}>
                <Icon icon={PriorityIcon} size={18} color={pColor} />
              </PressableScale>

              <PressableScale scaleTo={0.92} accessibilityLabel="Attachments" hitSlop={6} onPress={() => openTask(task.id)} style={styles.iconSlot}>
                <Icon icon={PaperclipIcon} size={18} color="muted" />
              </PressableScale>

              {task.discordChannelId ? (
                <PressableScale scaleTo={0.92}
                  accessibilityLabel={
                    (task.discordSubmissionRequired ?? true)
                      ? 'Discord submission required'
                      : 'Discord submission (optional)'
                  }
                  hitSlop={6}
                  onPress={() => openTask(task.id)}
                  style={styles.iconSlot}>
                  <Icon icon={faDiscord} size={16} color="muted" />
                </PressableScale>
              ) : null}
            </View>
          </View>

          {subtaskShown.length > 0 ? <SubtaskRows task={task} subtasks={subtaskShown} overflow={subtaskOverflow} /> : null}
        </View>
      </View>

      <LastActivity task={task} />

      <MenuSheet<TaskPriority>
        visible={priorityOpen}
        title="Priority"
        value={priority}
        options={PRIORITIES.map((p) => ({
          value: p,
          label: PRIORITY_LABELS[p],
          icon: p === 'high' ? ChevronsUpIcon : p === 'low' ? ChevronsDownIcon : ArrowUpIcon,
          iconColor: priorityColor(p, dark, theme),
        }))}
        onSelect={(p) => p !== priority && patchTask(task.id, { priority: p })}
        onClose={() => setPriorityOpen(false)}
      />
    </Animated.View>
  );
}

export const TaskCard = memo(TaskCardImpl);

/** Placeholder card while a column loads (`TaskCardSkeleton`). */
export function TaskCardSkeleton() {
  const theme = useTheme();
  return (
    <Pulse style={[styles.card, styles.skeleton, { backgroundColor: theme.card, ...elevation(theme, 'card') }]}>
      <View style={{ height: 12, width: '75%', borderRadius: 4, backgroundColor: theme.fill2 }} />
      <View style={{ height: 10, width: '50%', borderRadius: 4, backgroundColor: theme.fill2, marginTop: 10 }} />
    </Pulse>
  );
}

const styles = StyleSheet.create({
  repeatMark: { marginRight: 2 },
  card: { borderRadius: Radius.xl, overflow: 'hidden' },
  skeleton: { paddingHorizontal: 12, paddingVertical: 16, opacity: 0.7 },
  kanbanBody: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, gap: 6 },
  header: { flexDirection: 'row', alignItems: 'center' },
  // Web list card: `px-4 pt-3.5 pb-1.5`, checkbox and title 12dp apart.
  headerList: { gap: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  headerKanban: { gap: 6 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  overflow: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.base },
  checkbox: { alignItems: 'center', justifyContent: 'center' },
  // Indented to the title's edge (16 padding + 22 checkbox + 12 gap), like the web's `pl-12`.
  bodyList: { paddingLeft: 50, paddingRight: 16, paddingBottom: 14 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 32 },
  subtasksToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, marginLeft: -4, paddingHorizontal: 4, borderRadius: 8 },
  icons: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  iconSlot: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 16,
    paddingTop: 9,
    paddingBottom: 12,
  },
  dueChip: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth * 2,
    flexShrink: 1,
  },
  subtasks: { marginTop: 8, gap: 8 },
  subtaskRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
});
