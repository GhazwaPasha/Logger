import {
  faAnglesDown,
  faAnglesUp,
  faArrowUp,
  faBoxArchive,
  faChevronLeft,
} from '@fortawesome/free-solid-svg-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AttachmentsCard } from '@/components/tasks/detail/attachments-card';
import { CommentThreadCard } from '@/components/tasks/detail/comment-thread';
import { DependenciesCard } from '@/components/tasks/detail/dependencies-card';
import { DiscordSubmissionCard } from '@/components/tasks/detail/discord-submission-card';
import { DueDateFieldCard } from '@/components/tasks/detail/due-date-field';
import { HistoryCard } from '@/components/tasks/detail/history-card';
import { LevelListFieldCard } from '@/components/tasks/detail/level-list-field';
import { SubtaskListCard } from '@/components/tasks/detail/subtask-list';
import { TimeTrackingCard } from '@/components/tasks/detail/time-tracking-card';
import { AssigneeFieldCard } from '@/components/tasks/detail/assignee-field';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion/pressable-scale';
import { MenuSheet } from '@/components/menu-sheet';
import { PageEnter } from '@/components/page';
import { StatusPill } from '@/components/tasks/status-pill';
import { Text } from '@/components/text';
import { sequenceEnter } from '@/constants/motion';
import { Radius } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { CenteredSpinner, ErrorBanner } from '@/components/ui';
import { isWorkspaceOwner, taskEditCaps } from '@/lib/permissions';
import {
  useArchiveTask,
  useComments,
  usePatchTask,
  useSetSubtaskDone,
  useAddSubtask,
  useUpdateSubtask,
  useDeleteSubtask,
  useTaskDetail,
} from '@/lib/queries';
import {
  useAttachments,
  useBlockers,
  useBlocking,
  useDeleteAttachment,
  useDiscordChannels,
  useTimeEntries,
} from '@/lib/task-detail-queries';
import {
  dueChipColors,
  normalizeTaskStatus,
  PRIORITIES,
  PRIORITY_LABELS,
  priorityColor,
  stageControlDropdownOptions,
  taskPriority,
  type TaskPriority,
} from '@/lib/task-board';
import { useWorkspace } from '@/lib/workspace';

const PRIORITY_ICON = { high: faAnglesUp, medium: faArrowUp, low: faAnglesDown } as const;

/** Task details — the web's `TaskViewPanel`: title, subtasks, category/channel, stage + priority,
 * assignees, due date + recurrence, dependencies, time tracking, attachments, Discord submission,
 * comments, and a collapsible history log. */
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
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { org, members, lists, depts, userId } = useWorkspace();
  const timeZone = org?.timeZone ?? 'UTC';

  const detail = useTaskDetail(id);
  const comments = useComments(id);
  const attachments = useAttachments(id);
  const blockers = useBlockers(id);
  const blocking = useBlocking(id);
  const timeEntries = useTimeEntries(id);
  const discordChannels = useDiscordChannels(org?.id);

  const patch = usePatchTask();
  const setSubtaskDone = useSetSubtaskDone();
  const addSubtask = useAddSubtask(id);
  const updateSubtask = useUpdateSubtask(id);
  const deleteSubtask = useDeleteSubtask(id);
  const deleteAttachment = useDeleteAttachment(id);
  const archive = useArchiveTask();

  const [priorityOpen, setPriorityOpen] = useState(false);
  const [title, setTitle] = useState('');

  const names = useMemo(() => new Map(members.map((m) => [m.userId, m.name || m.email])), [members]);
  const ledgerNewestFirst = useMemo(
    () => [...(detail.data?.ledger ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [detail.data?.ledger],
  );

  const task = detail.data?.task;
  // Re-seed the local draft only when a different task loads — not on every server refresh —
  // so autosaved/optimistic updates never clobber text the user is mid-typing.
  useEffect(() => {
    if (task) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle(task.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/dashboard'));

  const topBar = (
    <View style={[styles.topBar, { borderBottomColor: theme.borderSubtle, paddingTop: insets.top + 6 }]}>
      <PressableScale scaleTo={0.94} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} onPress={close} style={styles.close}>
        <Icon icon={faChevronLeft} size={18} color="fg" />
      </PressableScale>
      <Text size="sm" weight="semibold" style={{ flex: 1 }} numberOfLines={1}>
        Task details
      </Text>
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
  if (detail.isError || !detail.data || !task) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.surfaceBase }]}>
        {topBar}
        <View style={{ padding: 12 }}>
          <ErrorBanner message={detail.error?.message ?? 'Could not load task.'} onRetry={() => void detail.refetch()} />
        </View>
      </View>
    );
  }

  const { capabilities, subtasks, assigneeUserIds } = detail.data;
  const stored = normalizeTaskStatus(task.status);
  const priority = taskPriority(task);
  const canEdit = taskEditCaps(task, lists, userId, members).canEditFields || capabilities.canEditFields;
  const canParticipate = capabilities.canParticipate;
  const dueColors = dueChipColors(task, dark, theme);
  const isOrgOwner = isWorkspaceOwner(members, userId);
  const creatorName = names.get(task.assignerId) ?? 'Someone';
  const discordChannelName = discordChannels.data?.find((c) => c.id === task.discordChannelId)?.name ?? null;
  const error =
    patch.error ?? setSubtaskDone.error ?? addSubtask.error ?? updateSubtask.error ?? deleteSubtask.error ?? archive.error;

  const commitTitle = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== task.title) patch.mutate({ taskId: task.id, patch: { title: trimmed } });
    else if (!trimmed) setTitle(task.title);
  };

  return (
    <View style={[styles.fill, { backgroundColor: theme.surfaceBase }]}>
      {topBar}
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {canEdit ? (
            <TextInput
              value={title}
              onChangeText={setTitle}
              onBlur={commitTitle}
              onSubmitEditing={commitTitle}
              multiline
              style={[styles.titleInput, { color: theme.fg }]}
            />
          ) : (
            <Text size="base" weight="semibold" lh={22}>
              {task.title}
            </Text>
          )}

          <SubtaskListCard
            subtasks={subtasks}
            disabled={!canParticipate}
            toggleOnly={!canEdit}
            pendingSubtaskId={
              updateSubtask.isPending ? (updateSubtask.variables?.subtaskId ?? null) : deleteSubtask.isPending ? (deleteSubtask.variables ?? null) : null
            }
            creating={addSubtask.isPending}
            onToggle={(subtaskId, done) => setSubtaskDone.mutate({ taskId: task.id, subtaskId, done })}
            onRename={(subtaskId, newTitle) => updateSubtask.mutate({ subtaskId, title: newTitle })}
            onDelete={(subtaskId) => deleteSubtask.mutate(subtaskId)}
            onCreate={(newTitle) => addSubtask.mutate(newTitle)}
          />

          <LevelListFieldCard
            listId={task.listId}
            lists={lists}
            depts={depts}
            canEdit={canEdit}
            onChange={(listId) => patch.mutate({ taskId: task.id, patch: { listId } })}
          />

          {/* Stage + priority */}
          <Animated.View entering={sequenceEnter(0, 6)} style={styles.row}>
            <StatusPill
              status={task.status}
              options={canParticipate ? stageControlDropdownOptions(stored, canEdit) : undefined}
              onChange={(status) => patch.mutate({ taskId: task.id, patch: { status } })}
              pending={patch.isPending}
            />
            <PressableScale
              scaleTo={0.97}
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
          </Animated.View>

          {error ? (
            <Text size="xs" color={dark ? '#f87171' : '#dc2626'}>
              {error.message}
            </Text>
          ) : null}

          <AssigneeFieldCard
            assigneeIds={assigneeUserIds}
            members={members}
            canEdit={canEdit}
            onToggle={(uid) => {
              const next = assigneeUserIds.includes(uid) ? assigneeUserIds.filter((x) => x !== uid) : [...assigneeUserIds, uid];
              patch.mutate({ taskId: task.id, patch: { assigneeUserIds: next } });
            }}
          />

          <DueDateFieldCard
            dueAt={task.dueAt}
            dueRepeat={task.dueRepeat ?? null}
            canEdit={canEdit}
            dueColor={dueColors.fg}
            onChangeDue={(iso) => patch.mutate({ taskId: task.id, patch: { dueAt: iso } })}
            onChangeDueRepeat={(repeat) => patch.mutate({ taskId: task.id, patch: { dueRepeat: repeat } })}
          />

          <DependenciesCard
            blockers={blockers.data ?? []}
            blocking={blocking.data ?? []}
            onOpenTask={(taskId) => router.push({ pathname: '/task/[id]', params: { id: taskId } })}
          />

          {task.timeTrackingEnabled ? <TimeTrackingCard entries={timeEntries.data ?? []} /> : null}

          <AttachmentsCard
            attachments={attachments.data ?? []}
            attachmentRequired={task.attachmentRequired}
            userId={userId ?? ''}
            isOwner={isOrgOwner}
            onDelete={(attachmentId) => deleteAttachment.mutate(attachmentId)}
          />

          {task.discordChannelId ? (
            <DiscordSubmissionCard
              taskId={task.id}
              required={task.discordSubmissionRequired}
              channelName={discordChannelName}
              channelNameLoading={discordChannels.isLoading}
            />
          ) : null}

          <CommentThreadCard taskId={task.id} members={members} userId={userId ?? ''} isOrgOwner={isOrgOwner} comments={comments.data ?? []} />

          <HistoryCard creatorName={creatorName} taskId={task.id} ledger={ledgerNewestFirst} names={names} timeZone={timeZone} />

          {capabilities.canArchiveTask ? (
            <PressableScale
              style={[styles.archiveBtn, { borderColor: theme.borderSubtle, backgroundColor: theme.surfaceElevated }]}
              onPress={() =>
                Alert.alert('Archive this task?', 'You can restore it later from Archived.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Archive', style: 'destructive', onPress: () => archive.mutate(task.id, { onSuccess: close }) },
                ])
              }>
              <Icon icon={faBoxArchive} size={13} color="muted" />
              <Text size="sm" weight="medium" color="muted">
                Archive task
              </Text>
            </PressableScale>
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
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 12, gap: 12, paddingBottom: 48 },
  titleInput: { fontSize: 17, fontWeight: '600', lineHeight: 23, padding: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  priority: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 24, paddingHorizontal: 10, borderRadius: Radius.base, borderWidth: 1 },
  archiveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.lg, borderWidth: 1, paddingVertical: 12 },
});
