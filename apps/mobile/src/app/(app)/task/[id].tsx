import { faBoxArchive, faChevronLeft, faEllipsis, faRotateLeft } from '@fortawesome/free-solid-svg-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { MenuSheet } from '@/components/menu-sheet';
import { PressableScale } from '@/components/motion/pressable-scale';
import { PageEnter } from '@/components/page';
import { AiFillCard } from '@/components/tasks/detail/ai-fill-card';
import { AttachmentsCard } from '@/components/tasks/detail/attachments-card';
import { CommentThreadCard } from '@/components/tasks/detail/comment-thread';
import { DependenciesCard } from '@/components/tasks/detail/dependencies-card';
import { DiscordSubmissionCard } from '@/components/tasks/detail/discord-submission-card';
import { HistoryCard } from '@/components/tasks/detail/history-card';
import { SubtaskListCard } from '@/components/tasks/detail/subtask-list';
import { TaskProperties } from '@/components/tasks/detail/task-properties';
import { TimeTrackingCard } from '@/components/tasks/detail/time-tracking-card';
import { Text } from '@/components/text';
import { Button, CenteredSpinner, ErrorBanner } from '@/components/ui';
import { revealIn, sequenceEnter } from '@/constants/motion';
import { alpha, Fonts, Radius } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { isDefaultTitle } from '@/lib/draft-task';
import { formatDateOnly } from '@/lib/format';
import { isWorkspaceOwner, taskEditCaps } from '@/lib/permissions';
import {
  useAddSubtask,
  useArchiveTask,
  useComments,
  useDeleteSubtask,
  usePatchTask,
  useRestoreTask,
  useSetSubtaskDone,
  useTaskDetail,
  useUpdateSubtask,
  type TaskPatch,
} from '@/lib/queries';
import { toDueLocal, type TaskAiFillResult } from '@/lib/task-ai-fill';
import {
  dueChipColors,
  normalizeTaskStatus,
  stageControlDropdownOptions,
  storedStatusToFlowColumn,
  taskPriority,
} from '@/lib/task-board';
import {
  useAttachments,
  useBlockers,
  useBlocking,
  useDeleteAttachment,
  useDiscordChannels,
  useTimeEntries,
} from '@/lib/task-detail-queries';
import { useWorkspace } from '@/lib/workspace';

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
  const { id, draft } = useLocalSearchParams<{ id: string; draft?: string }>();
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
  const restore = useRestoreTask();

  const [menuOpen, setMenuOpen] = useState(false);
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
      setTitle(isDefaultTitle(task.title) ? '' : task.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  const close = () => {
    // A draft that was never filled in is discarded (the web's `onDeleteDraft`), so backing out leaves no "Untitled task".
    if (
      draft === '1' &&
      task &&
      isDefaultTitle(task.title) &&
      !title.trim() &&
      !detail.data?.subtasks.length &&
      !detail.data?.assigneeUserIds.length &&
      !task.dueAt
    ) {
      archive.mutate(task.id);
    }
    if (router.canGoBack()) router.back();
    else router.replace('/dashboard');
  };

  const saving =
    patch.isPending || addSubtask.isPending || updateSubtask.isPending || deleteSubtask.isPending || setSubtaskDone.isPending;
  const canArchive = !!detail.data?.capabilities.canArchiveTask && !task?.deletedAt;
  const canRestore = !!detail.data?.capabilities.canRestoreTask && !!task?.deletedAt;

  const topBar = (
    <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
      <PressableScale scaleTo={0.94} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} onPress={close} style={styles.iconBtn}>
        <Icon icon={faChevronLeft} size={18} color="fg" />
      </PressableScale>
      <View style={{ flex: 1 }} />
      {saving ? (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(250)} style={styles.saving}>
          <ActivityIndicator size="small" color={theme.muted} style={{ transform: [{ scale: 0.7 }] }} />
          <Text size="xs" color="muted">
            Saving
          </Text>
        </Animated.View>
      ) : null}
      {canArchive || canRestore ? (
        <PressableScale
          scaleTo={0.94}
          accessibilityRole="button"
          accessibilityLabel="More actions"
          hitSlop={8}
          onPress={() => setMenuOpen(true)}
          style={styles.iconBtn}>
          <Icon icon={faEllipsis} size={18} color="fg" />
        </PressableScale>
      ) : null}
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
        <View style={{ padding: 16 }}>
          <ErrorBanner message={detail.error?.message ?? 'Could not load task.'} onRetry={() => void detail.refetch()} />
        </View>
      </View>
    );
  }

  const { capabilities, subtasks, assigneeUserIds } = detail.data;
  const stored = normalizeTaskStatus(task.status);
  const canEdit = taskEditCaps(task, lists, userId, members).canEditFields || capabilities.canEditFields;
  const canParticipate = capabilities.canParticipate;
  const dueColors = dueChipColors(task, dark, theme);
  const isOrgOwner = isWorkspaceOwner(members, userId);
  const creatorName = names.get(task.assignerId) ?? 'Someone';
  const error =
    patch.error ??
    setSubtaskDone.error ??
    addSubtask.error ??
    updateSubtask.error ??
    deleteSubtask.error ??
    archive.error ??
    restore.error ??
    deleteAttachment.error;
  const archived = !!task.deletedAt;
  const allAttachments = attachments.data ?? [];
  const sentToDiscord = allAttachments.filter((a) => a.discordDeliveredAt);
  const otherAttachments = allAttachments.filter((a) => !a.discordDeliveredAt);
  const showDiscord = !!task.discordChannelId || (isOrgOwner && (discordChannels.data?.length ?? 0) > 0);
  const hasWorkSection =
    showDiscord ||
    (task.discordChannelId ? otherAttachments : allAttachments).length > 0 ||
    (blockers.data?.length ?? 0) > 0 ||
    (blocking.data?.length ?? 0) > 0 ||
    !!task.timeTrackingEnabled;

  const setPatch = (p: TaskPatch) => patch.mutate({ taskId: task.id, patch: p });

  const commitTitle = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== task.title) setPatch({ title: trimmed });
    else if (!trimmed && !isDefaultTitle(task.title)) setTitle(task.title);
  };

  /** Everything the AI filled goes out as one PATCH — fields and new checklist lines in a single transaction. */
  const applyAi = (r: TaskAiFillResult) => {
    const p: TaskPatch = {};
    if (r.title) {
      p.title = r.title;
      setTitle(r.title);
    }
    if (r.priority) p.priority = r.priority;
    if (r.status) p.status = r.status;
    // One assignee per task.
    if (r.assigneeUserIds) p.assigneeUserIds = r.assigneeUserIds.slice(0, 1);
    if (r.dueLocal !== null) {
      if (r.dueLocal === '') {
        p.dueAt = null;
        p.dueRepeat = null;
      } else {
        const due = new Date(r.dueLocal);
        // The API rejects a due date in the past, which would sink the whole save (assignees included).
        if (!Number.isNaN(due.getTime()) && due.getTime() > Date.now()) p.dueAt = due.toISOString();
      }
    }
    if (r.dueRepeat !== null && p.dueAt !== null && (p.dueAt || task.dueAt)) {
      p.dueRepeat = r.dueRepeat === 'none' ? null : r.dueRepeat;
    }
    const existing = new Set(subtasks.map((st) => st.title.trim()));
    const lines = (r.subtasks ?? []).map((l) => l.trim()).filter((l) => l && !existing.has(l));
    if (lines.length > 0) p.subtasksToCreate = lines.map((l) => ({ title: l }));
    if (Object.keys(p).length > 0) setPatch(p);
  };

  return (
    <View style={[styles.fill, { backgroundColor: theme.surfaceBase }]}>
      {topBar}
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled">
          {/* Archived: say so up top, with the way back. Flips the moment you archive / restore. */}
          {archived ? (
            <Animated.View
              entering={revealIn}
              style={[styles.archivedBanner, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle }]}>
              <Icon icon={faBoxArchive} size={14} color="muted" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" weight="semibold">
                  Archived
                </Text>
                <Text size="xs" color="muted" numberOfLines={1}>
                  {`Since ${formatDateOnly(task.deletedAt!, timeZone)} · hidden from boards`}
                </Text>
              </View>
              {capabilities.canRestoreTask ? (
                <Button title="Restore" variant="secondary" compact onPress={() => restore.mutate(task.id)} />
              ) : null}
            </Animated.View>
          ) : null}

          {canEdit ? (
            <Animated.View entering={sequenceEnter(0, 8)}>
              <AiFillCard
                members={members}
                existingDraft={{ title: title.trim() || undefined, dueLocal: toDueLocal(task.dueAt), dueRepeat: task.dueRepeat ?? null }}
                onApply={applyAi}
              />
            </Animated.View>
          ) : null}

          <Animated.View entering={sequenceEnter(1, 8)} style={styles.titleWrap}>
            {canEdit ? (
              <TextInput
                value={title}
                onChangeText={setTitle}
                onBlur={commitTitle}
                onSubmitEditing={commitTitle}
                submitBehavior="blurAndSubmit"
                returnKeyType="done"
                multiline
                autoFocus={draft === '1'}
                placeholder="What needs doing?"
                placeholderTextColor={alpha(theme.muted, 0.7)}
                style={[styles.titleInput, { color: theme.fg }]}
              />
            ) : (
              <Text font="outfit" size="xl" weight="bold" tracking={-0.4} lh={28}>
                {task.title}
              </Text>
            )}
            <Text size="xs" color="muted">
              {`Created by ${creatorName}`}
            </Text>
          </Animated.View>

          <Animated.View entering={sequenceEnter(2, 8)}>
            <SubtaskListCard
              subtasks={subtasks}
              disabled={!canParticipate}
              toggleOnly={!canEdit}
              pendingSubtaskId={
                updateSubtask.isPending
                  ? (updateSubtask.variables?.subtaskId ?? null)
                  : deleteSubtask.isPending
                    ? (deleteSubtask.variables ?? null)
                    : null
              }
              creating={addSubtask.isPending}
              onToggle={(subtaskId, done) => setSubtaskDone.mutate({ taskId: task.id, subtaskId, done })}
              onRename={(subtaskId, newTitle) => updateSubtask.mutate({ subtaskId, title: newTitle })}
              onDelete={(subtaskId) => deleteSubtask.mutate(subtaskId)}
              onCreate={(newTitle) => addSubtask.mutate(newTitle)}
            />
          </Animated.View>

          <TaskProperties
            enterIndex={3}
            status={storedStatusToFlowColumn(stored)}
            statusOptions={canParticipate ? stageControlDropdownOptions(stored, canEdit) : []}
            statusPending={patch.isPending && patch.variables?.patch.status !== undefined}
            priority={taskPriority(task)}
            assigneeIds={assigneeUserIds}
            dueAt={task.dueAt}
            dueRepeat={task.dueRepeat ?? null}
            dueColor={dueColors.fg}
            listId={task.listId}
            members={members}
            lists={lists}
            depts={depts}
            canEdit={canEdit}
            onStatus={(status) => setPatch({ status })}
            onPriority={(priority) => setPatch({ priority })}
            onAssignee={(uid) => setPatch({ assigneeUserIds: uid ? [uid] : [] })}
            onDue={(iso) => setPatch({ dueAt: iso })}
            onDueRepeat={(repeat) => setPatch({ dueRepeat: repeat })}
            onList={(listId) => setPatch({ listId })}
          />

          {error ? (
            <Animated.View entering={revealIn}>
              <ErrorBanner message={error.message} />
            </Animated.View>
          ) : null}


          {hasWorkSection ? (
            <Animated.View entering={sequenceEnter(4, 8)} style={styles.section}>
              {/* Everyone sees it once a channel is set; the owner can also switch it on for any task (new ones too). */}
              {showDiscord ? (
                <DiscordSubmissionCard
                  taskId={task.id}
                  channelId={task.discordChannelId ?? null}
                  channels={discordChannels.data ?? []}
                  channelsLoading={discordChannels.isLoading}
                  canConfigure={isOrgOwner}
                  canEditFields={canEdit}
                  canSubmit={canParticipate && !archived}
                  required={task.discordSubmissionRequired}
                  sent={sentToDiscord}
                  userId={userId ?? ''}
                  isOwner={isOrgOwner}
                  onSetChannel={(discordChannelId) =>
                    setPatch(discordChannelId ? { discordChannelId } : { discordChannelId: null, discordSubmissionRequired: false })
                  }
                  onSetRequired={(discordSubmissionRequired) => setPatch({ discordSubmissionRequired })}
                  onDelete={(attachmentId) => deleteAttachment.mutate(attachmentId)}
                />
              ) : null}

              {/* Files delivered to Discord are listed in the Discord card ("… sent to Discord"), not here. */}
              <AttachmentsCard
                attachments={task.discordChannelId ? otherAttachments : allAttachments}
                attachmentRequired={task.attachmentRequired}
                userId={userId ?? ''}
                isOwner={isOrgOwner}
                onDelete={(attachmentId) => deleteAttachment.mutate(attachmentId)}
              />

              <DependenciesCard
                blockers={blockers.data ?? []}
                blocking={blocking.data ?? []}
                onOpenTask={(taskId) => router.push({ pathname: '/task/[id]', params: { id: taskId } })}
              />

              {task.timeTrackingEnabled ? <TimeTrackingCard entries={timeEntries.data ?? []} /> : null}
            </Animated.View>
          ) : null}

          <Animated.View entering={sequenceEnter(5, 8)} style={styles.section}>
            <CommentThreadCard taskId={task.id} members={members} userId={userId ?? ''} isOrgOwner={isOrgOwner} comments={comments.data ?? []} />
            <HistoryCard creatorName={creatorName} taskId={task.id} ledger={ledgerNewestFirst} names={names} timeZone={timeZone} />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      <MenuSheet<'archive' | 'restore'>
        visible={menuOpen}
        title="Task"
        options={[
          ...(canArchive ? [{ value: 'archive' as const, label: 'Archive task', icon: faBoxArchive }] : []),
          ...(canRestore ? [{ value: 'restore' as const, label: 'Restore task', icon: faRotateLeft }] : []),
        ]}
        onSelect={(action) => {
          setMenuOpen(false);
          if (action === 'restore') restore.mutate(task.id);
          else
            Alert.alert('Archive this task?', 'It leaves the boards straight away. You can restore it from here or from Archived.', [
              { text: 'Cancel', style: 'cancel' },
              // Optimistic: the task leaves the boards and this screen turns "Archived" at once; stay here so
              // Restore (and any error) is right in front of you.
              { text: 'Archive', style: 'destructive', onPress: () => archive.mutate(task.id) },
            ]);
        }}
        onClose={() => setMenuOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingBottom: 4 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  saving: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6 },
  content: { paddingHorizontal: 16, paddingTop: 4, gap: 16 },
  titleWrap: { gap: 6, paddingHorizontal: 2 },
  titleInput: { fontFamily: Fonts.outfit.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.4, padding: 0 },
  section: { gap: 12 },
  archivedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: Radius.xl,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
