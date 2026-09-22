import {
  faAnglesDown,
  faAnglesUp,
  faArrowUp,
  faBoxArchive,
  faCheck,
  faPlus,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/motion/pressable-scale';
import { Icon } from '@/components/icon';
import { MenuSheet } from '@/components/menu-sheet';
import { PageEnter, SectionLabel } from '@/components/page';
import { StatusPill } from '@/components/tasks/status-pill';
import { Text } from '@/components/text';
import { Avatar, Button, CenteredSpinner, EmptyState, ErrorBanner, Input } from '@/components/ui';
import { alpha, Radius } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { describeLedger, formatDueForListPill, formatLogTimestamp, timeAgo } from '@/lib/format';
import { taskEditCaps } from '@/lib/permissions';
import {
  useAddSubtask,
  useArchiveTask,
  useComments,
  usePatchTask,
  usePostComment,
  useSetSubtaskDone,
  useTaskDetail,
} from '@/lib/queries';
import {
  dueChipColors,
  normalizeTaskStatus,
  PRIORITIES,
  PRIORITY_LABELS,
  priorityColor,
  stageControlDropdownOptions,
  taskPriority,
  taskShowsLateFooter,
  type TaskPriority,
} from '@/lib/task-board';
import { useWorkspace } from '@/lib/workspace';

const PRIORITY_ICON = { high: faAnglesUp, medium: faArrowUp, low: faAnglesDown } as const;

/** Task details — the web's `TaskViewPanel`: header, title, stage + priority, assignees, due date, checklist, comments, history. */
export default function TaskScreenRoute() {
  return (
    <PageEnter>
      <TaskScreen />
    </PageEnter>
  );
}

function TaskScreen() {
  const theme = useTheme();
  const dark = useIsDark();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { org, members, lists, userId } = useWorkspace();
  const timeZone = org?.timeZone ?? 'UTC';

  const detail = useTaskDetail(id);
  const comments = useComments(id);
  const patch = usePatchTask();
  const setSubtaskDone = useSetSubtaskDone();
  const addSubtask = useAddSubtask(id);
  const postComment = usePostComment(id);
  const archive = useArchiveTask();

  const [priorityOpen, setPriorityOpen] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');
  const [comment, setComment] = useState('');

  const names = useMemo(() => new Map(members.map((m) => [m.userId, m.name || m.email])), [members]);
  const ledger = useMemo(
    () => [...(detail.data?.ledger ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [detail.data?.ledger],
  );

  const close = () => (router.canGoBack() ? router.back() : router.replace('/work'));

  const topBar = (
    <View style={[styles.topBar, { borderBottomColor: theme.borderSubtle }]}>
      <Text size="sm" weight="semibold" style={{ flex: 1 }} numberOfLines={1}>
        Task details
      </Text>
      <PressableScale scaleTo={0.97} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} onPress={close} style={styles.close}>
        <Icon icon={faXmark} size={16} color="muted" />
      </PressableScale>
    </View>
  );

  if (detail.isLoading) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.surfaceBase }]}>
        {topBar}
        <CenteredSpinner />
      </View>
    );
  }
  if (detail.isError || !detail.data) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.surfaceBase }]}>
        {topBar}
        <View style={{ padding: 12 }}>
          <ErrorBanner message={detail.error?.message ?? 'Could not load task.'} onRetry={() => void detail.refetch()} />
        </View>
      </View>
    );
  }

  const { task, capabilities, subtasks, assigneeUserIds } = detail.data;
  const stored = normalizeTaskStatus(task.status);
  const priority = taskPriority(task);
  const canEdit = taskEditCaps(task, lists, userId, members).canEditFields || capabilities.canEditFields;
  const canParticipate = capabilities.canParticipate;
  const due = dueChipColors(task, dark, theme);
  const late = taskShowsLateFooter(task);
  const error = patch.error ?? setSubtaskDone.error ?? addSubtask.error ?? postComment.error ?? archive.error;
  const doneCount = subtasks.filter((s) => s.done).length;

  return (
    <View style={[styles.fill, { backgroundColor: theme.surfaceBase }]}>
      {topBar}
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text size="base" weight="semibold" lh={22}>
            {task.title}
          </Text>

          {/* Stage + priority */}
          <View style={styles.row}>
            <StatusPill
              status={task.status}
              options={canParticipate ? stageControlDropdownOptions(stored, canEdit) : undefined}
              onChange={(status) => patch.mutate({ taskId: task.id, patch: { status } })}
              pending={patch.isPending}
            />
            <PressableScale scaleTo={0.97}
              accessibilityRole="button"
              accessibilityLabel={`Priority: ${PRIORITY_LABELS[priority]}`}
              disabled={!canEdit}
              onPress={() => setPriorityOpen(true)}
              style={[styles.priority, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle }]}>
              <Icon icon={PRIORITY_ICON[priority]} size={12} color={priorityColor(priority, dark, theme)} />
              <Text size="xs" weight="medium">
                {PRIORITY_LABELS[priority]}
              </Text>
            </PressableScale>
          </View>

          {error ? <Text size="xs" color={dark ? '#f87171' : '#dc2626'}>{error.message}</Text> : null}

          {/* Assignees */}
          <View style={styles.section}>
            <SectionLabel size="10">Assignees</SectionLabel>
            {assigneeUserIds.length === 0 ? (
              <Text size="sm" color="muted">
                Unassigned
              </Text>
            ) : (
              <View style={styles.chips}>
                {assigneeUserIds.map((uid) => {
                  const m = members.find((x) => x.userId === uid);
                  return (
                    <View
                      key={uid}
                      style={[styles.assignee, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle }]}>
                      <Avatar name={m?.name} email={m?.email} image={m?.image} size={20} />
                      <Text size="sm" weight="medium">
                        {names.get(uid) ?? 'Someone'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Due date */}
          <View style={styles.section}>
            <SectionLabel size="10">Due date</SectionLabel>
            {task.dueAt ? (
              <View style={[styles.due, { backgroundColor: due.bg, borderColor: due.border }]}>
                <Text size="xs" weight="medium" color={due.fg} tabular>
                  {late ? 'Overdue · ' : ''}
                  {formatDueForListPill(task.dueAt, timeZone)}
                </Text>
              </View>
            ) : (
              <Text size="sm" color="muted">
                No due date
              </Text>
            )}
          </View>

          {/* Checklist */}
          {subtasks.length > 0 || canEdit ? (
            <View style={styles.section}>
              <SectionLabel size="10">{`Subtasks${subtasks.length ? ` · ${doneCount}/${subtasks.length}` : ''}`}</SectionLabel>
              {subtasks.map((s) => (
                <PressableScale scaleTo={0.97}
                  key={s.id}
                  disabled={!canParticipate}
                  haptic="select"
                  onPress={() => setSubtaskDone.mutate({ taskId: task.id, subtaskId: s.id, done: !s.done })}
                  style={styles.subtask}>
                  <View
                    style={[
                      styles.checkbox,
                      s.done
                        ? { backgroundColor: theme.accent, borderColor: theme.accent }
                        : { backgroundColor: theme.surfaceElevated, borderColor: alpha(theme.fg, dark ? 0.22 : 0.18) },
                    ]}>
                    {s.done ? <Icon icon={faCheck} size={9} color={theme.onAccent} /> : null}
                  </View>
                  <Text
                    size="sm"
                    color={s.done ? 'muted' : 'fg'}
                    style={[{ flex: 1 }, s.done && { textDecorationLine: 'line-through', textDecorationColor: theme.muted }]}>
                    {s.title}
                  </Text>
                </PressableScale>
              ))}
              {canEdit ? (
                <View style={styles.addRow}>
                  <Input
                    style={{ flex: 1, minHeight: 40 }}
                    placeholder="Add a subtask…"
                    value={newSubtask}
                    onChangeText={setNewSubtask}
                    onSubmitEditing={() => {
                      const title = newSubtask.trim();
                      if (title) addSubtask.mutate(title, { onSuccess: () => setNewSubtask('') });
                    }}
                    returnKeyType="done"
                  />
                  <Button
                    title="Add"
                    icon={faPlus}
                    variant="secondary"
                    loading={addSubtask.isPending}
                    disabled={!newSubtask.trim()}
                    onPress={() => {
                      const title = newSubtask.trim();
                      if (title) addSubtask.mutate(title, { onSuccess: () => setNewSubtask('') });
                    }}
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Comments */}
          <View style={styles.section}>
            <SectionLabel size="10">Comments</SectionLabel>
            {(comments.data ?? []).filter((c) => !c.deletedAt).map((c) => (
              <View key={c.id} style={[styles.comment, { borderColor: theme.borderSubtle, backgroundColor: theme.surfaceElevated }]}>
                <Avatar name={c.authorName} email={c.authorEmail} image={c.authorImage} size={24} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={styles.row}>
                    <Text size="sm" weight="semibold">
                      {c.authorName || c.authorEmail}
                    </Text>
                    <Text size="11" color="muted">
                      {timeAgo(c.createdAt)}
                      {c.editedAt ? ' · edited' : ''}
                    </Text>
                  </View>
                  <Text size="sm">{c.body}</Text>
                </View>
              </View>
            ))}
            {comments.data && comments.data.filter((c) => !c.deletedAt).length === 0 ? (
              <Text size="sm" color="muted">
                No comments yet.
              </Text>
            ) : null}
            {canParticipate ? (
              <View style={{ gap: 8 }}>
                <Input
                  style={{ minHeight: 72, textAlignVertical: 'top', paddingTop: 10 }}
                  placeholder="Write a comment…"
                  value={comment}
                  onChangeText={setComment}
                  multiline
                />
                <Button
                  title="Comment"
                  loading={postComment.isPending}
                  disabled={!comment.trim()}
                  onPress={() => postComment.mutate(comment.trim(), { onSuccess: () => setComment('') })}
                />
              </View>
            ) : null}
          </View>

          {/* History */}
          <View style={styles.section}>
            <SectionLabel size="10">History</SectionLabel>
            {ledger.length === 0 ? (
              <EmptyState compact icon={faCheck} title="No activity yet" />
            ) : (
              <View style={[styles.history, { borderColor: theme.borderSubtle, backgroundColor: theme.surfaceElevated }]}>
                {ledger.map((row) => (
                  <Text key={row.id} font="mono" size="11" lh={16} color="muted">
                    {formatLogTimestamp(row.createdAt, timeZone)}
                    {': '}
                    <Text font="mono" size="11" lh={16} color={alpha(theme.fg, 0.9)}>
                      {names.get(row.actorId) ?? 'Someone'} {describeLedger(row, names, timeZone)}
                    </Text>
                  </Text>
                ))}
              </View>
            )}
          </View>

          {capabilities.canArchiveTask ? (
            <Button
              title="Archive task"
              icon={faBoxArchive}
              variant="secondary"
              loading={archive.isPending}
              onPress={() => archive.mutate(task.id, { onSuccess: close })}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <MenuSheet<TaskPriority>
        visible={priorityOpen}
        title="Priority"
        value={priority}
        options={PRIORITIES.map((p) => ({
          value: p,
          label: PRIORITY_LABELS[p],
          icon: PRIORITY_ICON[p],
          iconColor: priorityColor(p, dark, theme),
        }))}
        onSelect={(p) => p !== priority && patch.mutate({ taskId: task.id, patch: { priority: p } })}
        onClose={() => setPriorityOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  close: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 12, gap: 12, paddingBottom: 48 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  section: { gap: 8, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  assignee: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, paddingLeft: 6, paddingRight: 12, borderRadius: Radius.full, borderWidth: 1 },
  priority: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 24, paddingHorizontal: 10, borderRadius: Radius.base, borderWidth: 1 },
  due: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1 },
  subtask: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  checkbox: { width: 18, height: 18, borderRadius: Radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  comment: { flexDirection: 'row', gap: 10, padding: 10, borderRadius: Radius.xl, borderWidth: 1 },
  history: { padding: 10, gap: 6, borderRadius: Radius.xl, borderWidth: 1 },
});
