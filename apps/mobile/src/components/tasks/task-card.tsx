import { faDiscord } from '@fortawesome/free-brands-svg-icons';
import {
  faAnglesDown,
  faAnglesUp,
  faArrowUp,
  faBell,
  faCalendarPlus,
  faCheck,
  faEllipsisVertical,
  faPaperclip,
  faPlus,
  faStopwatch,
  faUserPlus,
} from '@fortawesome/free-solid-svg-icons';
import { memo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

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
import { alpha, Radius, Tone } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { formatDueForListPill } from '@/lib/format';
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

function Checkbox({
  checked,
  busy,
  disabled,
  onPress,
  radius,
  label,
  iconSize = 11,
}: {
  checked: boolean;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
  radius: number;
  label: string;
  iconSize?: number;
}) {
  const theme = useTheme();
  const dark = useIsDark();
  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled: !!disabled, busy: !!busy }}
      disabled={disabled || busy}
      hitSlop={8}
      scaleTo={0.86}
      haptic="select"
      onPress={onPress}
      style={[
        styles.checkbox,
        { borderRadius: radius },
        checked
          ? { backgroundColor: theme.accent, borderColor: theme.accent }
          : { backgroundColor: theme.surfaceBase, borderColor: alpha(theme.fg, dark ? 0.22 : 0.18) },
        disabled && !checked && { opacity: 0.4 },
        stateTransition,
      ]}>
      {busy ? (
        <ActivityIndicator size="small" color={checked ? theme.onAccent : theme.muted} style={{ transform: [{ scale: 0.55 }] }} />
      ) : checked ? (
        <Animated.View entering={ZoomIn.duration(Duration.micro).easing(POP_EASE)}>
          <Icon icon={faCheck} size={iconSize} color={theme.onAccent} />
        </Animated.View>
      ) : null}
    </PressableScale>
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
          <View style={{ marginTop: 1 }}>
            <Checkbox
              checked={s.done}
              radius={Radius.md}
              iconSize={9}
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
  const subtaskShown = kanban ? subtasks.slice(0, KANBAN_SUBTASK_PREVIEW) : expanded ? subtasks : [];
  const subtaskOverflow = kanban && subtasks.length > KANBAN_SUBTASK_PREVIEW ? subtasks.length - KANBAN_SUBTASK_PREVIEW : 0;

  const titleColor = cancelled || done ? 'muted' : 'fg';
  const titleDecoration = cancelled
    ? ({ textDecorationLine: 'line-through', textDecorationColor: Tone.red500 } as const)
    : done
      ? ({ textDecorationLine: 'line-through', textDecorationColor: theme.muted } as const)
      : null;

  const PriorityIcon = priority === 'high' ? faAnglesUp : priority === 'low' ? faAnglesDown : faArrowUp;
  const pColor = priorityColor(priority, dark, theme);
  const dueLabel = task.dueAt ? formatDueForListPill(task.dueAt, timeZone) : null;

  return (
    <Animated.View
      layout={listLayout}
      entering={enterIndex === undefined ? undefined : cardEnter(enterIndex)}
      style={[
        styles.card,
        {
          backgroundColor: theme.surfaceElevated,
          borderColor: syncing ? alpha(theme.accent, 0.26) : theme.borderSubtle,
        },
      ]}>
      {syncing ? <SyncRibbon /> : null}
      <View style={kanban ? styles.kanbanBody : undefined}>
        {/* Header: [checkbox] title · status · overflow */}
        <View style={[styles.header, kanban ? styles.headerKanban : styles.headerList]}>
          {!kanban ? (
            <Checkbox
              checked={done}
              busy={syncing}
              disabled={cancelled || (!done && advanceTo == null)}
              radius={Radius.base}
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
              size={kanban ? '15' : 'sm'}
              lh={kanban ? 21 : 19}
              weight={kanban ? 'semibold' : 'medium'}
              tracking={kanban ? -0.3 : undefined}
              color={titleColor}
              numberOfLines={kanban ? 3 : 2}
              style={titleDecoration}>
              {task.title}
            </Text>
          </PressableScale>

          <View style={styles.headerRight}>
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
              <Icon icon={faEllipsisVertical} size={16} color="muted" style={{ opacity: 0.5 }} />
            </PressableScale>
          </View>
        </View>

        {/* Subtasks + meta row */}
        <View
          style={[
            styles.meta,
            { borderTopColor: alpha(theme.borderSubtle, 0.4) },
            kanban ? { paddingTop: 10 } : { paddingHorizontal: 12, paddingTop: 11, paddingBottom: 12 },
          ]}>
          <View style={styles.metaRow}>
            <PressableScale scaleTo={0.92}
              accessibilityRole="button"
              accessibilityLabel={subtasks.length ? 'View subtasks' : 'Add subtasks'}
              onPress={() => (kanban || subtasks.length === 0 ? openTask(task.id) : setExpanded((v) => !v))}
              hitSlop={6}
              style={styles.subtasksToggle}>
              <Text size="13" weight="medium" color="muted">
                Subtasks
              </Text>
              {subtasks.length > 0 ? (
                <Text size="13" color={alpha(theme.muted, 0.8)} tabular>
                  ({subtasks.length})
                </Text>
              ) : null}
              {subtasks.length > 0 && !kanban ? (
                <RotatingChevron open={expanded} size={11} />
              ) : subtasks.length === 0 ? (
                <Icon icon={faPlus} size={14} color="muted" style={{ opacity: 0.6 }} />
              ) : null}
            </PressableScale>

            <View style={{ flex: 1 }} />

            <View style={styles.icons}>
              <PressableScale scaleTo={0.92}
                accessibilityLabel={assignee ? `Assignee: ${assignee.name || assignee.email}` : 'No assignee'}
                hitSlop={6}
                onPress={() => openTask(task.id)}
                style={styles.iconSlot}>
                {assignee ? (
                  <Avatar name={assignee.name} email={assignee.email} image={assignee.image} size={20} tint={alpha(Tone.sky500, 0.2)} />
                ) : (
                  <Icon icon={faUserPlus} size={16} color="muted" style={{ opacity: 0.8 }} />
                )}
              </PressableScale>

              <PressableScale scaleTo={0.92}
                accessibilityLabel={dueLabel ? `Due ${dueLabel}${late ? ' — Overdue' : ''}` : 'No due date'}
                hitSlop={6}
                onPress={() => openTask(task.id)}
                style={[styles.dueChip, { backgroundColor: due.bg, borderColor: due.border }]}>
                <Icon icon={late ? faBell : task.dueAt ? faStopwatch : faCalendarPlus} size={14} color={due.fg} />
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
                <Icon icon={PriorityIcon} size={16} color={pColor} />
              </PressableScale>

              <PressableScale scaleTo={0.92} accessibilityLabel="Attachments" hitSlop={6} onPress={() => openTask(task.id)} style={styles.iconSlot}>
                <Icon icon={faPaperclip} size={16} color="muted" />
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

      <MenuSheet<TaskPriority>
        visible={priorityOpen}
        title="Priority"
        value={priority}
        options={PRIORITIES.map((p) => ({
          value: p,
          label: PRIORITY_LABELS[p],
          icon: p === 'high' ? faAnglesUp : p === 'low' ? faAnglesDown : faArrowUp,
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
    <Pulse style={[styles.card, styles.skeleton, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle }]}>
      <View style={{ height: 12, width: '75%', borderRadius: 3, backgroundColor: theme.surfaceHover }} />
      <View style={{ height: 10, width: '50%', borderRadius: 3, backgroundColor: theme.surfaceHover, marginTop: 10 }} />
    </Pulse>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.xl, borderWidth: 1, overflow: 'hidden' },
  skeleton: { paddingHorizontal: 12, paddingVertical: 16, opacity: 0.7 },
  kanbanBody: { paddingHorizontal: 12, paddingTop: 14, paddingBottom: 12, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center' },
  headerList: { gap: 8, paddingHorizontal: 12, paddingTop: 16, paddingBottom: 12 },
  headerKanban: { gap: 6 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  overflow: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.base },
  checkbox: { width: 18, height: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  meta: { borderTopWidth: StyleSheet.hairlineWidth * 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  subtasksToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  icons: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  iconSlot: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  dueChip: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    flexShrink: 1,
  },
  subtasks: { marginTop: 6, gap: 4 },
  subtaskRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
});
