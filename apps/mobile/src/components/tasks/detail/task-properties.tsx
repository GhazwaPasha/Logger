import {
  faAnglesDown,
  faAnglesUp,
  faArrowUp,
  faCalendarDays,
  faChevronRight,
  faCircleHalfStroke,
  faFlag,
  faLayerGroup,
  faUser,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { MenuSheet } from '@/components/menu-sheet';
import { PressableScale } from '@/components/motion/pressable-scale';
import { STATUS_ICONS } from '@/components/tasks/status-pill';
import { AssigneeSheet } from '@/components/tasks/detail/assignee-field';
import { DueDateSheet, REPEAT_LABEL } from '@/components/tasks/detail/due-date-field';
import { LevelListSheet } from '@/components/tasks/detail/level-list-field';
import { Text } from '@/components/text';
import { Avatar } from '@/components/ui';
import { sequenceEnter } from '@/constants/motion';
import { alpha, Radius } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { NODE_LABELS } from '@/lib/labels';
import {
  FLOW_COLUMN_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  priorityColor,
  statusPillColors,
  type ManualTaskStatus,
  type TaskPriority,
} from '@/lib/task-board';
import type { Dept, ListRow, MemberRow, TaskDueRepeat } from '@/lib/types';

const PRIORITY_ICON = { high: faAnglesUp, medium: faArrowUp, low: faAnglesDown } as const;

function formatDue(d: Date): string {
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

/**
 * A task's properties as one quiet grouped list — Status, Priority, Assignee, Due, Channel — each a row with its
 * current value on the right; tapping a row opens its picker as a bottom sheet. Read-only rows lose the chevron.
 */
export function TaskProperties({
  enterIndex,
  status,
  statusOptions,
  statusPending,
  priority,
  assigneeIds,
  dueAt,
  dueRepeat,
  dueColor,
  listId,
  members,
  lists,
  depts,
  canEdit,
  onStatus,
  onPriority,
  onAssignee,
  onDue,
  onDueRepeat,
  onList,
}: {
  enterIndex: number;
  status: ManualTaskStatus;
  /** Stages this user can move the task to (empty / one = read-only). */
  statusOptions: ManualTaskStatus[];
  statusPending?: boolean;
  priority: TaskPriority;
  assigneeIds: string[];
  dueAt: string | null;
  dueRepeat: TaskDueRepeat | null;
  /** Due text colour (overdue → red). */
  dueColor?: string;
  listId: string;
  members: MemberRow[];
  lists: ListRow[];
  depts: Dept[];
  canEdit: boolean;
  onStatus: (s: ManualTaskStatus) => void;
  onPriority: (p: TaskPriority) => void;
  /** One assignee per task: `null` unassigns. */
  onAssignee: (userId: string | null) => void;
  onDue: (iso: string | null) => void;
  onDueRepeat: (repeat: TaskDueRepeat | null) => void;
  onList: (listId: string) => void;
}) {
  const theme = useTheme();
  const dark = useIsDark();
  const [open, setOpen] = useState<null | 'status' | 'priority' | 'assignee' | 'due' | 'list'>(null);
  const close = () => setOpen(null);

  const statusColors = statusPillColors(status, dark, theme);
  const canChangeStatus = statusOptions.length > 1;
  const assignee = members.find((m) => m.userId === assigneeIds[0]) ?? null;
  const extraAssignees = Math.max(0, assigneeIds.length - 1);
  const due = dueAt ? new Date(dueAt) : null;
  const list = lists.find((l) => l.id === listId) ?? null;
  const dept = list ? (depts.find((d) => d.id === list.departmentId) ?? null) : null;
  const divider = alpha(theme.fg, dark ? 0.08 : 0.07);

  return (
    <Animated.View
      entering={sequenceEnter(enterIndex, 8)}
      style={[styles.group, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle }]}>
      <Row icon={faCircleHalfStroke} label="Status" onPress={canChangeStatus ? () => setOpen('status') : undefined}>
        <View style={[styles.statusPill, { backgroundColor: statusColors.bg }]}>
          {statusPending ? (
            <ActivityIndicator size="small" color={statusColors.fg} style={{ transform: [{ scale: 0.6 }] }} />
          ) : (
            <Icon icon={STATUS_ICONS[status]} size={11} color={statusColors.fg} />
          )}
          <Text size="xs" weight="semibold" color={statusColors.fg}>
            {FLOW_COLUMN_LABELS[status]}
          </Text>
        </View>
      </Row>
      <Divider color={divider} />
      <Row icon={faFlag} label="Priority" onPress={canEdit ? () => setOpen('priority') : undefined}>
        <Icon icon={PRIORITY_ICON[priority]} size={12} color={priorityColor(priority, dark, theme)} />
        <Text size="sm" weight="medium">
          {PRIORITY_LABELS[priority]}
        </Text>
      </Row>
      <Divider color={divider} />
      <Row icon={faUser} label="Assignee" onPress={canEdit ? () => setOpen('assignee') : undefined}>
        {assignee ? (
          <>
            <Avatar name={assignee.name} email={assignee.email} image={assignee.image} size={22} />
            <Text size="sm" weight="medium" numberOfLines={1} style={{ flexShrink: 1 }}>
              {assignee.name || assignee.email}
            </Text>
            {extraAssignees ? (
              <Text size="xs" color="muted">
                {`+${extraAssignees}`}
              </Text>
            ) : null}
          </>
        ) : (
          <Text size="sm" color="muted">
            {canEdit ? 'Assign' : 'Unassigned'}
          </Text>
        )}
      </Row>
      <Divider color={divider} />
      <Row icon={faCalendarDays} label="Due" onPress={canEdit ? () => setOpen('due') : undefined}>
        {due ? (
          <>
            <Text size="sm" weight="medium" color={dueColor ?? 'fg'} numberOfLines={1} style={{ flexShrink: 1 }}>
              {formatDue(due)}
            </Text>
            {dueRepeat ? (
              <View style={[styles.tag, { backgroundColor: alpha(theme.fg, 0.06) }]}>
                <Text size="11" weight="medium" color="muted">
                  {REPEAT_LABEL[dueRepeat]}
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <Text size="sm" color="muted">
            {canEdit ? 'Set a date' : 'None'}
          </Text>
        )}
      </Row>
      <Divider color={divider} />
      <Row icon={faLayerGroup} label={NODE_LABELS.list} onPress={canEdit ? () => setOpen('list') : undefined}>
        {dept ? (
          <Text size="sm" color="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
            {`${dept.name}  ›`}
          </Text>
        ) : null}
        <Text size="sm" weight="medium" numberOfLines={1} style={{ flexShrink: 1 }}>
          {list?.name ?? 'Choose'}
        </Text>
      </Row>

      <MenuSheet<ManualTaskStatus>
        visible={open === 'status'}
        title="Status"
        value={status}
        options={statusOptions.map((s) => ({ value: s, label: FLOW_COLUMN_LABELS[s], icon: STATUS_ICONS[s] }))}
        onSelect={(s) => {
          close();
          if (s !== status) onStatus(s);
        }}
        onClose={close}
      />
      <MenuSheet<TaskPriority>
        visible={open === 'priority'}
        title="Priority"
        value={priority}
        options={PRIORITIES.map((p) => ({
          value: p,
          label: PRIORITY_LABELS[p],
          icon: PRIORITY_ICON[p],
          iconColor: priorityColor(p, dark, theme),
        }))}
        onSelect={(p) => {
          close();
          if (p !== priority) onPriority(p);
        }}
        onClose={close}
      />
      <AssigneeSheet
        visible={open === 'assignee'}
        assigneeIds={assigneeIds.slice(0, 1)}
        members={members}
        onToggle={(uid) => {
          close();
          // One assignee: picking someone replaces whoever was there; picking the current one unassigns.
          onAssignee(assigneeIds[0] === uid && assigneeIds.length === 1 ? null : uid);
        }}
        onClose={close}
      />
      <DueDateSheet
        visible={open === 'due'}
        due={due}
        dueRepeat={dueRepeat}
        onClose={close}
        onChangeDue={onDue}
        onChangeDueRepeat={onDueRepeat}
      />
      <LevelListSheet
        visible={open === 'list'}
        lists={lists}
        depts={depts}
        initialDeptId={dept?.id ?? null}
        onClose={close}
        onPick={(id) => {
          close();
          if (id !== listId) onList(id);
        }}
      />
    </Animated.View>
  );
}

function Row({
  icon,
  label,
  onPress,
  children,
}: {
  icon: IconDefinition;
  label: string;
  onPress?: () => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <PressableScale
      disabled={!onPress}
      onPress={onPress}
      scaleTo={0.99}
      haptic={onPress ? 'select' : false}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.surfaceHover }]}>
      <Icon icon={icon} size={13} color="muted" style={{ width: 16 }} />
      <Text size="sm" color="muted" style={styles.label}>
        {label}
      </Text>
      <View style={styles.value}>{children}</View>
      {onPress ? <Icon icon={faChevronRight} size={10} color="muted" style={{ opacity: 0.6 }} /> : null}
    </PressableScale>
  );
}

const Divider = ({ color }: { color: string }) => <View style={[styles.divider, { backgroundColor: color }]} />;

const styles = StyleSheet.create({
  group: { borderRadius: Radius.xxl, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingHorizontal: 14 },
  label: { width: 76 },
  value: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  divider: { height: StyleSheet.hairlineWidth * 2, marginLeft: 40 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, height: 24, borderRadius: Radius.full },
  tag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.full },
});
