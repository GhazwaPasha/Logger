import { faLayerGroup, faListUl, faPlus } from '@fortawesome/free-solid-svg-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ActionMenu, type ActionMenuItem } from '@/components/action-menu';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Pulse } from '@/components/motion/pulse';
import { RotatingChevron } from '@/components/motion/rotating-chevron';
import { useCollapseOnScroll, useTabBarInset } from '@/components/shell/tab-bar/tab-bar-context';
import { Text } from '@/components/text';
import { EmptyState, ErrorBanner } from '@/components/ui';
import { listLayout, revealIn, revealOut, stateTransition } from '@/constants/motion';
import { alpha, Fonts, Radius } from '@/constants/theme';
import { useChannelUnread } from '@/hooks/use-channel-unread';
import { useTheme } from '@/hooks/use-theme';
import { NODE_LABELS } from '@/lib/labels';
import { isWorkspaceOwner } from '@/lib/permissions';
import {
  useCreateDepartment,
  useCreateList,
  useDeleteDepartment,
  useDeleteList,
  useRenameDepartment,
  useRenameList,
} from '@/lib/queries';
import { useWorkspace } from '@/lib/workspace';

type StructureTarget =
  | { kind: 'level'; deptId: string; name: string }
  | { kind: 'list'; listId: string; deptId: string; name: string };

/**
 * The Channels tab, laid out open like Slack / Discord: collapsible category headers (chevron on the left),
 * then a plain list of `# channel` rows — no cards or dividers. Unread channels are bold with the Discord-style
 * pill on the screen edge; the open-task count sits quietly on the right. Owners long-press a category or channel to add / rename / delete,
 * as in the web sidebar.
 */
export function ChannelTree() {
  const theme = useTheme();
  const bottomInset = useTabBarInset();
  const onScroll = useCollapseOnScroll();
  const { org, depts, lists, members, userId, isLoading, refetch, setList } = useWorkspace();
  const unread = useChannelUnread();

  const orgId = org?.id;
  const createDept = useCreateDepartment(orgId);
  const createList = useCreateList(orgId);
  const renameDept = useRenameDepartment(orgId);
  const deleteDept = useDeleteDepartment(orgId);
  const renameList = useRenameList(orgId);
  const deleteList = useDeleteList(orgId);

  /** Only workspace owners may create/rename/delete categories / channels (mirrors the API). */
  const canEditStructure = isWorkspaceOwner(members, userId);

  const [collapsedDepts, setCollapsedDepts] = useState<Set<string>>(new Set());
  const [addingLevel, setAddingLevel] = useState(false);
  const [addListFor, setAddListFor] = useState<string | null>(null);
  const [renamingLevelId, setRenamingLevelId] = useState<string | null>(null);
  const [renamingListId, setRenamingListId] = useState<string | null>(null);
  const [structureMenu, setStructureMenu] = useState<StructureTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const listsByDept = new Map<string, typeof lists>();
  for (const l of [...lists].sort((a, b) => a.orderIndex - b.orderIndex)) {
    listsByDept.set(l.departmentId, [...(listsByDept.get(l.departmentId) ?? []), l]);
  }

  const toggle = (deptId: string) =>
    setCollapsedDepts((prev) => {
      const next = new Set(prev);
      if (!next.delete(deptId)) next.add(deptId);
      return next;
    });

  const openChannel = (listId: string) => {
    setList(listId);
    unread.markListSeen(listId);
    router.push({ pathname: '/channels/[listId]', params: { listId } });
  };

  const fail = (fallback: string) => (e: Error) => setError(e.message || fallback);

  function addLevel(name: string) {
    setError(null);
    createDept.mutate(name, {
      onSuccess: () => setAddingLevel(false),
      onError: fail(`Could not add ${NODE_LABELS.level.toLowerCase()}`),
    });
  }

  function addList(deptId: string, name: string) {
    setError(null);
    createList.mutate(
      { name, departmentId: deptId },
      { onSuccess: () => setAddListFor(null), onError: fail(`Could not add ${NODE_LABELS.list.toLowerCase()}`) },
    );
  }

  function renameLevel(deptId: string, name: string) {
    setError(null);
    renameDept.mutate(
      { deptId, name },
      { onSuccess: () => setRenamingLevelId(null), onError: fail(`Could not rename ${NODE_LABELS.level.toLowerCase()}`) },
    );
  }

  function renameChannel(listId: string, name: string) {
    setError(null);
    renameList.mutate(
      { listId, name },
      { onSuccess: () => setRenamingListId(null), onError: fail(`Could not rename ${NODE_LABELS.list.toLowerCase()}`) },
    );
  }

  function confirmDeleteLevel(deptId: string, name: string) {
    Alert.alert(
      `Delete this ${NODE_LABELS.level.toLowerCase()}?`,
      `“${name}” and every ${NODE_LABELS.list.toLowerCase()} and task under it will be permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Delete ${NODE_LABELS.level}`,
          style: 'destructive',
          onPress: () => {
            setError(null);
            deleteDept.mutate(deptId, { onError: fail(`Could not delete ${NODE_LABELS.level.toLowerCase()}`) });
          },
        },
      ],
    );
  }

  function confirmDeleteChannel(listId: string, name: string) {
    Alert.alert(
      `Delete this ${NODE_LABELS.list.toLowerCase()}?`,
      `“${name}” and every task in it will be permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Delete ${NODE_LABELS.list}`,
          style: 'destructive',
          onPress: () => {
            setError(null);
            deleteList.mutate(listId, { onError: fail(`Could not delete ${NODE_LABELS.list.toLowerCase()}`) });
          },
        },
      ],
    );
  }

  /** Structure action sheet items — the touch counterpart of the web's `structureMenuItems`. */
  const structureMenuItems: ActionMenuItem[] =
    !structureMenu || !canEditStructure
      ? []
      : structureMenu.kind === 'level'
        ? [
            {
              id: 'add-list',
              label: `Add ${NODE_LABELS.list}`,
              onSelect: () => {
                const deptId = structureMenu.deptId;
                setCollapsedDepts((prev) => {
                  const next = new Set(prev);
                  next.delete(deptId);
                  return next;
                });
                setAddListFor(deptId);
              },
            },
            {
              id: 'rename-level',
              label: `Rename ${NODE_LABELS.level}`,
              onSelect: () => {
                setRenamingListId(null);
                setRenamingLevelId(structureMenu.deptId);
              },
            },
            {
              id: 'delete-level',
              label: `Delete ${NODE_LABELS.level}`,
              destructive: true,
              onSelect: () => confirmDeleteLevel(structureMenu.deptId, structureMenu.name),
            },
          ]
        : [
            {
              id: 'rename-list',
              label: `Rename ${NODE_LABELS.list}`,
              onSelect: () => {
                setRenamingLevelId(null);
                setRenamingListId(structureMenu.listId);
              },
            },
            {
              id: 'delete-list',
              label: `Delete ${NODE_LABELS.list}`,
              destructive: true,
              onSelect: () => confirmDeleteChannel(structureMenu.listId, structureMenu.name),
            },
          ];

  let body: React.ReactNode;
  if (isLoading && depts.length === 0) {
    body = (
      <View style={styles.skeletons}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Pulse key={i} style={styles.skeleton}>
            <View
              style={{
                height: i % 3 === 0 ? 10 : 14,
                width: i % 3 === 0 ? '35%' : `${62 - i * 5}%`,
                borderRadius: 4,
                backgroundColor: theme.surfaceHover,
              }}
            />
          </Pulse>
        ))}
      </View>
    );
  } else if (depts.length === 0 && !addingLevel) {
    body = (
      <EmptyState
        icon={faLayerGroup}
        title={`No ${NODE_LABELS.levelPlural.toLowerCase()} yet`}
        description={
          canEditStructure
            ? `Add a ${NODE_LABELS.level.toLowerCase()} to start organising ${NODE_LABELS.listPlural.toLowerCase()}.`
            : `Ask a workspace owner to add a ${NODE_LABELS.level.toLowerCase()}.`
        }
      />
    );
  } else {
    body = depts.map((d) => {
      const open = !collapsedDepts.has(d.id);
      const levelLists = listsByDept.get(d.id) ?? [];
      return (
        <Animated.View key={d.id} layout={listLayout} style={styles.section}>
          {renamingLevelId === d.id ? (
            <InlineNameInput
              placeholder={`Name your ${NODE_LABELS.level.toLowerCase()}`}
              initialValue={d.name}
              busy={renameDept.isPending}
              onSubmit={(name) => renameLevel(d.id, name)}
              onCancel={() => setRenamingLevelId(null)}
            />
          ) : (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={open ? `Collapse ${d.name}` : `Expand ${d.name}`}
              accessibilityState={{ expanded: open }}
              scaleTo={0.99}
              onPress={() => toggle(d.id)}
              onLongPress={canEditStructure ? () => setStructureMenu({ kind: 'level', deptId: d.id, name: d.name }) : undefined}
              style={({ pressed }) => [
                styles.levelRow,
                { backgroundColor: pressed ? theme.surfaceHover : 'transparent' },
                stateTransition,
              ]}>
              <RotatingChevron open={open} size={10} />
              <Text size="xs" weight="semibold" color="muted" uppercase tracking={0.6} numberOfLines={1} style={{ flex: 1 }}>
                {d.name}
              </Text>
            </PressableScale>
          )}

          {open ? (
            <Animated.View entering={revealIn} exiting={revealOut}>
              {levelLists.length === 0 && addListFor !== d.id ? (
                <EmptyState compact icon={faListUl} title={`No ${NODE_LABELS.listPlural.toLowerCase()} yet`} />
              ) : (
                levelLists.map((l) => {
                  const hasUnread = unread.hasUnread(l.id);
                  const count = unread.openCount(l.id);
                  if (renamingListId === l.id) {
                    return (
                      <View key={l.id}>
                        <InlineNameInput
                          placeholder={`Name your ${NODE_LABELS.list.toLowerCase()}`}
                          initialValue={l.name}
                          busy={renameList.isPending}
                          onSubmit={(name) => renameChannel(l.id, name)}
                          onCancel={() => setRenamingListId(null)}
                        />
                      </View>
                    );
                  }
                  return (
                    <View key={l.id}>
                      {hasUnread ? <View pointerEvents="none" style={[styles.unreadPill, { backgroundColor: theme.fg }]} /> : null}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${l.name}${hasUnread ? ', new activity' : ''}, ${count} open`}
                        onPress={() => openChannel(l.id)}
                        onLongPress={
                          canEditStructure
                            ? () => setStructureMenu({ kind: 'list', listId: l.id, deptId: d.id, name: l.name })
                            : undefined
                        }
                        style={({ pressed }) => [styles.channelRow, pressed && { backgroundColor: theme.surfaceHover }]}>
                        <Text font="outfit" size="sm" weight="medium" color={hasUnread ? 'fg' : 'muted'} style={styles.hash}>
                          #
                        </Text>
                        <Text
                          font="outfit"
                          size="sm"
                          weight={hasUnread ? 'bold' : 'medium'}
                          color={hasUnread ? 'fg' : alpha(theme.fg, 0.72)}
                          numberOfLines={1}
                          style={{ flex: 1 }}>
                          {l.name}
                        </Text>
                        {count > 0 ? (
                          <Text size="xs" weight="medium" color="muted" tabular>
                            {count}
                          </Text>
                        ) : null}
                      </Pressable>
                    </View>
                  );
                })
              )}
              {addListFor === d.id ? (
                <InlineNameInput
                  placeholder={`Name your ${NODE_LABELS.list.toLowerCase()}`}
                  busy={createList.isPending}
                  onSubmit={(name) => addList(d.id, name)}
                  onCancel={() => setAddListFor(null)}
                />
              ) : null}
            </Animated.View>
          ) : null}
        </Animated.View>
      );
    });
  }

  return (
    <>
      <Animated.ScrollView
        style={{ flex: 1, backgroundColor: theme.surfaceBase }}
        contentContainerStyle={[styles.content, { paddingBottom: 24 + bottomInset }]}
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={theme.muted}
            onRefresh={() => {
              setRefreshing(true);
              refetch();
              setTimeout(() => setRefreshing(false), 800);
            }}
          />
        }>
        {error ? <ErrorBanner message={error} /> : null}
        {body}

        {addingLevel ? (
          <InlineNameInput
            placeholder={`Name your ${NODE_LABELS.level.toLowerCase()}`}
            busy={createDept.isPending}
            onSubmit={addLevel}
            onCancel={() => setAddingLevel(false)}
          />
        ) : canEditStructure && !isLoading ? (
          <PressableScale
            accessibilityRole="button"
            scaleTo={0.98}
            onPress={() => setAddingLevel(true)}
            style={({ pressed }) => [styles.addLevel, { backgroundColor: pressed ? theme.surfaceHover : 'transparent' }]}>
            <Icon icon={faPlus} size={12} color="muted" />
            <Text size="sm" weight="medium" color="muted">
              Add {NODE_LABELS.level.toLowerCase()}
            </Text>
          </PressableScale>
        ) : null}
      </Animated.ScrollView>

      <ActionMenu
        visible={structureMenu != null && structureMenuItems.length > 0}
        title={structureMenu?.name}
        items={structureMenuItems}
        onClose={() => setStructureMenu(null)}
      />
    </>
  );
}

/**
 * Inline "name your category / channel" field — used both to create one (empty start) and to rename
 * one (`initialValue` pre-filled). Enter submits; leaving it with (changed) text submits too; leaving
 * it empty, or unchanged, cancels — the same flow as the web sidebar.
 */
function InlineNameInput({
  placeholder,
  initialValue = '',
  busy,
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  initialValue?: string;
  busy: boolean;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const [value, setValue] = useState(initialValue);
  const submitted = useRef(false);

  // After a failed create/rename the field stays mounted; let the user retry.
  useEffect(() => {
    if (!busy) submitted.current = false;
  }, [busy]);

  const submit = () => {
    const name = value.trim();
    if (!name || name === initialValue || busy || submitted.current) {
      if (!name || name === initialValue) onCancel();
      return;
    }
    submitted.current = true;
    onSubmit(name);
  };

  return (
    <Animated.View entering={revealIn} exiting={revealOut} style={styles.inlineWrap}>
      <TextInput
        autoFocus
        selectTextOnFocus={!!initialValue}
        editable={!busy}
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor={theme.muted}
        cursorColor={theme.accent}
        selectionColor={theme.accentMuted}
        returnKeyType="done"
        onSubmitEditing={submit}
        onBlur={() => {
          if (busy || submitted.current) return;
          if (value.trim()) submit();
          else onCancel();
        }}
        maxLength={256}
        style={[
          styles.inline,
          {
            backgroundColor: theme.surfaceBase,
            borderColor: theme.border,
            color: theme.fg,
            fontFamily: Fonts.outfit.medium,
            opacity: busy ? 0.7 : 1,
          },
        ]}
      />
      {busy ? <ActivityIndicator size="small" color={theme.muted} style={styles.inlineSpinner} /> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 8, paddingTop: 0, gap: 4 },
  section: { gap: 0 },
  // Category header: chevron first, like the Slack / Discord sidebars.
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 32,
    paddingLeft: 12,
    paddingRight: 14,
    borderRadius: 10,
  },
  hash: { width: 14, textAlign: 'center' },
  /** Discord-style unread indicator: a half-pill on the screen's left edge, beside the row. */
  unreadPill: {
    position: 'absolute',
    left: -8,
    top: '50%',
    marginTop: -4,
    width: 4,
    height: 8,
    zIndex: 1,
    borderTopRightRadius: Radius.full,
    borderBottomRightRadius: Radius.full,
  },
  skeletons: { gap: 0, paddingTop: 4 },
  skeleton: { height: 32, justifyContent: 'center', paddingHorizontal: 12, opacity: 0.7 },
  addLevel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  inlineWrap: { padding: 8 },
  inline: { height: 40, borderRadius: Radius.lg, borderWidth: 1, paddingHorizontal: 12, paddingRight: 36, fontSize: 15 },
  inlineSpinner: { position: 'absolute', right: 20, top: 0, bottom: 0 },
});
