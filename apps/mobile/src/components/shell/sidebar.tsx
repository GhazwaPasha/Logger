import { faLayerGroup, faListUl } from '@fortawesome/free-solid-svg-icons';
import * as SecureStore from 'expo-secure-store';
import { router, usePathname, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionMenu, type ActionMenuItem } from '@/components/action-menu';
import { PressableScale } from '@/components/motion/pressable-scale';
import { RotatingChevron } from '@/components/motion/rotating-chevron';
import { useShell } from '@/components/shell/shell-context';
import { Text } from '@/components/text';
import { EmptyState } from '@/components/ui';
import { Duration, fadeOut, listLayout, popIn, POP_EASE, revealIn, revealOut, stateTransition } from '@/constants/motion';
import { Fonts, Radius, Tone } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { authClient } from '@/lib/auth-client';
import { NODE_LABELS } from '@/lib/labels';
import { isWorkspaceOwner } from '@/lib/permissions';
import {
  useActiveTasks,
  useCreateDepartment,
  useCreateList,
  useDeleteDepartment,
  useDeleteList,
  useRenameDepartment,
  useRenameList,
} from '@/lib/queries';
import { useWorkspace } from '@/lib/workspace';

/** Per-workspace blob of `{ listId: lastSeenEpochMs }`, mirroring the web's per-list `localStorage` keys. */
const listLastSeenKey = (orgId: string) => `logbase.listLastSeen.${orgId}`;

/** A pressable sidebar row (`rowBase` in `WorkspaceSidebar.tsx`): 4px radius, accent-muted when active. */
function Row({
  active,
  onPress,
  onLongPress,
  children,
  style,
}: {
  active?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  children: React.ReactNode;
  style?: object;
}) {
  const theme = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      onPress={onPress}
      onLongPress={onLongPress}
      scaleTo={0.99}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: active ? theme.accentMuted : pressed ? theme.surfaceHover : 'transparent' },
        stateTransition,
        style as object,
      ]}>
      {children}
    </PressableScale>
  );
}

/**
 * The four primary links, with the active-item highlight sliding between rows (the web's shared-layout
 * `sidebar-primary-nav-pill`, 280ms) instead of jumping.
 */
function PrimaryNav({
  items,
  onGo,
}: {
  items: { href: Href; label: string; active: boolean }[];
  onGo: (href: Href) => void;
}) {
  const theme = useTheme();
  const [layouts, setLayouts] = useState<Record<number, { y: number; h: number }>>({});
  const activeIndex = items.findIndex((i) => i.active);
  const target = activeIndex >= 0 ? layouts[activeIndex] : undefined;

  const y = useSharedValue(0);
  const h = useSharedValue(0);
  const visible = useSharedValue(0);
  const placed = useRef(false);

  useEffect(() => {
    if (!target) {
      visible.value = withTiming(0, { duration: Duration.micro });
      placed.current = false;
      return;
    }
    if (!placed.current) {
      // First appearance: drop it in place, then fade up — no sweep from the corner.
      y.value = target.y;
      h.value = target.h;
      placed.current = true;
    } else {
      y.value = withTiming(target.y, { duration: Duration.pill, easing: POP_EASE });
      h.value = withTiming(target.h, { duration: Duration.pill, easing: POP_EASE });
    }
    visible.value = withTiming(1, { duration: Duration.micro });
  }, [target?.y, target?.h, target, y, h, visible]);

  const pill = useAnimatedStyle(() => ({
    opacity: visible.value,
    height: h.value,
    transform: [{ translateY: y.value }],
  }));

  return (
    <View style={styles.primary}>
      <Animated.View
        pointerEvents="none"
        style={[styles.pill, { backgroundColor: theme.accentMuted }, pill]}
      />
      {items.map((item, i) => (
        <View
          key={item.label}
          onLayout={(e) => {
            const { y: ly, height } = e.nativeEvent.layout;
            setLayouts((prev) => (prev[i]?.y === ly && prev[i]?.h === height ? prev : { ...prev, [i]: { y: ly, h: height } }));
          }}>
          <Row onPress={() => onGo(item.href)}>
            <Text font="outfit" weight="semibold" numberOfLines={1}>
              {item.label}
            </Text>
          </Row>
        </View>
      ))}
    </View>
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
            backgroundColor: theme.surfaceElevated,
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

export function Sidebar() {
  const theme = useTheme();
  const dark = useIsDark();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { closeDrawer } = useShell();
  const { data: session } = authClient.useSession();
  const { orgs, org, setOrgId, depts, lists, members, userId, scope, setList } = useWorkspace();
  const active = useActiveTasks(org?.id);
  const createDept = useCreateDepartment(org?.id);
  const createList = useCreateList(org?.id);
  const renameDept = useRenameDepartment(org?.id);
  const deleteDept = useDeleteDepartment(org?.id);
  const renameList = useRenameList(org?.id);
  const deleteList = useDeleteList(org?.id);

  /** Only workspace owners may create/rename/delete categories / channels (mirrors the API). */
  const canEditStructure = isWorkspaceOwner(members, userId);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [treeOpen, setTreeOpen] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addingLevel, setAddingLevel] = useState(false);
  const [addListFor, setAddListFor] = useState<string | null>(null);
  const [renamingLevelId, setRenamingLevelId] = useState<string | null>(null);
  const [renamingListId, setRenamingListId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Long-press target for the structure action sheet — mirrors the web's right-click `structureMenu`. */
  const [structureMenu, setStructureMenu] = useState<
    | null
    | { kind: 'workspace' }
    | { kind: 'level'; deptId: string; name: string }
    | { kind: 'list'; listId: string; deptId: string; name: string }
  >(null);

  /** Newest task activity per list — drives the Discord-style unread pill (mirrors `WorkspaceSidebar.tsx`). */
  const latestActivityByListId = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of active.data ?? []) {
      const iso = t.lastLedger?.createdAt ?? t.updatedAt ?? t.createdAt;
      if (!iso) continue;
      const ts = new Date(iso).getTime();
      if (Number.isNaN(ts)) continue;
      if (ts > (m.get(t.listId) ?? 0)) m.set(t.listId, ts);
    }
    return m;
  }, [active.data]);

  const [listLastSeen, setListLastSeen] = useState<Record<string, number>>({});

  /** Hydrate this workspace's last-seen timestamps once its id is known. */
  useEffect(() => {
    const orgId = org?.id;
    if (!orgId) return;
    let live = true;
    SecureStore.getItemAsync(listLastSeenKey(orgId))
      .then((raw) => {
        if (!live) return;
        try {
          setListLastSeen(raw ? (JSON.parse(raw) as Record<string, number>) : {});
        } catch {
          setListLastSeen({});
        }
      })
      .catch(() => live && setListLastSeen({}));
    return () => {
      live = false;
    };
  }, [org?.id]);

  const markListSeen = useCallback(
    (listId: string) => {
      const orgId = org?.id;
      if (!orgId) return;
      setListLastSeen((prev) => {
        const next = { ...prev, [listId]: Date.now() };
        SecureStore.setItemAsync(listLastSeenKey(orgId), JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [org?.id],
  );

  const listsByDept = useMemo(() => {
    const m = new Map<string, typeof lists>();
    for (const l of [...lists].sort((a, b) => a.orderIndex - b.orderIndex)) {
      m.set(l.departmentId, [...(m.get(l.departmentId) ?? []), l]);
    }
    return m;
  }, [lists]);

  const go = (href: Href) => {
    closeDrawer();
    router.navigate(href);
  };
  const is = (p: string) => pathname === p || pathname.startsWith(`${p}/`);
  const onBoard = pathname === '/work';

  // Keep the currently open list marked as seen while new activity arrives on it — otherwise
  // navigating away would immediately show it as unread despite having just watched it happen.
  useEffect(() => {
    if (!onBoard || !scope.listId) return;
    const latest = latestActivityByListId.get(scope.listId) ?? 0;
    if (latest > (listLastSeen[scope.listId] ?? 0)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      markListSeen(scope.listId);
    }
  }, [onBoard, scope.listId, latestActivityByListId, listLastSeen, markListSeen]);

  const toggle = (deptId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(deptId)) next.add(deptId);
      return next;
    });

  function addLevel(name: string) {
    setError(null);
    createDept.mutate(name, {
      onSuccess: () => setAddingLevel(false),
      onError: (e) => setError(e.message || `Could not add ${NODE_LABELS.level.toLowerCase()}`),
    });
  }

  function addList(deptId: string, name: string) {
    setError(null);
    createList.mutate(
      { name, departmentId: deptId },
      {
        onSuccess: () => setAddListFor(null),
        onError: (e) => setError(e.message || `Could not add ${NODE_LABELS.list.toLowerCase()}`),
      },
    );
  }

  function renameLevel(deptId: string, name: string) {
    setError(null);
    renameDept.mutate(
      { deptId, name },
      {
        onSuccess: () => setRenamingLevelId(null),
        onError: (e) => setError(e.message || `Could not rename ${NODE_LABELS.level.toLowerCase()}`),
      },
    );
  }

  function renameChannel(listId: string, name: string) {
    setError(null);
    renameList.mutate(
      { listId, name },
      {
        onSuccess: () => setRenamingListId(null),
        onError: (e) => setError(e.message || `Could not rename ${NODE_LABELS.list.toLowerCase()}`),
      },
    );
  }

  function confirmDeleteLevel(deptId: string, name: string) {
    Alert.alert(`Delete this ${NODE_LABELS.level.toLowerCase()}?`, `“${name}” and every ${NODE_LABELS.list.toLowerCase()} and task under it will be permanently removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: `Delete ${NODE_LABELS.level}`,
        style: 'destructive',
        onPress: () => {
          setError(null);
          deleteDept.mutate(deptId, {
            onError: (e) => setError(e.message || `Could not delete ${NODE_LABELS.level.toLowerCase()}`),
          });
        },
      },
    ]);
  }

  function confirmDeleteChannel(listId: string, name: string) {
    Alert.alert(`Delete this ${NODE_LABELS.list.toLowerCase()}?`, `“${name}” and every task in it will be permanently removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: `Delete ${NODE_LABELS.list}`,
        style: 'destructive',
        onPress: () => {
          setError(null);
          deleteList.mutate(listId, {
            onError: (e) => setError(e.message || `Could not delete ${NODE_LABELS.list.toLowerCase()}`),
          });
        },
      },
    ]);
  }

  /** Structure action sheet items — the touch counterpart of the web's `structureMenuItems`. */
  const structureMenuItems: ActionMenuItem[] =
    !structureMenu || !canEditStructure
      ? []
      : structureMenu.kind === 'workspace'
        ? [
            {
              id: 'add-level',
              label: `Add ${NODE_LABELS.level}`,
              onSelect: () => {
                setTreeOpen(true);
                setAddingLevel(true);
              },
            },
          ]
        : structureMenu.kind === 'level'
          ? [
              {
                id: 'add-list',
                label: `Add ${NODE_LABELS.list}`,
                onSelect: () => {
                  const deptId = structureMenu.deptId;
                  setExpanded((prev) => new Set(prev).add(deptId));
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

  const userLabel = session?.user.name?.trim() || session?.user.email || '';

  const primary: { href: Href; label: string; active: boolean }[] = [
    { href: '/dashboard', label: 'Dashboard', active: is('/dashboard') },
    { href: '/roadmap', label: 'Roadmap', active: is('/roadmap') },
    { href: '/calendar', label: 'Calendar', active: is('/calendar') },
    { href: '/my-tasks', label: 'My tasks', active: is('/my-tasks') },
  ];
  const footer: { href: Href; label: string; active: boolean }[] = [
    { href: '/archived', label: 'Archived', active: is('/archived') },
    { href: '/people', label: 'Team', active: is('/people') },
    { href: '/settings', label: 'Your settings', active: is('/settings') },
    { href: '/organization-settings', label: 'Organization settings', active: is('/organization-settings') },
  ];

  return (
    <View
      style={[
        styles.fill,
        { backgroundColor: theme.surfaceNav, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}>
      <ActionMenu
        visible={structureMenu != null && structureMenuItems.length > 0}
        items={structureMenuItems}
        onClose={() => setStructureMenu(null)}
      />

      {/* Workspace switcher + primary navigation */}
      <View style={[styles.head, { borderBottomColor: theme.borderSubtle }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Toggle workspace switcher"
          accessibilityState={{ expanded: pickerOpen }}
          onPress={() => setPickerOpen((v) => !v)}
          style={({ pressed }) => [styles.switcher, pressed && { backgroundColor: theme.surfaceHover }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text font="outfit" weight="bold" numberOfLines={1}>
              {org?.name ?? '—'}
            </Text>
            <Text font="outfit" color="muted" numberOfLines={1}>
              {userLabel}
            </Text>
          </View>
          <RotatingChevron open={pickerOpen} />
        </Pressable>

        {pickerOpen ? (
          <Animated.View
            entering={popIn}
            exiting={fadeOut}
            style={[
              styles.picker,
              { backgroundColor: theme.surfaceBase, borderColor: theme.borderSubtle, transformOrigin: 'left top' },
            ]}>
            {orgs.map((o) => (
              <Row
                key={o.id}
                active={o.id === org?.id}
                onPress={() => {
                  setOrgId(o.id);
                  setPickerOpen(false);
                }}>
                <Text font="outfit" weight="medium" numberOfLines={1}>
                  {o.name}
                </Text>
              </Row>
            ))}
          </Animated.View>
        ) : null}

        <Animated.View layout={listLayout}>
          <PrimaryNav items={primary} onGo={go} />
        </Animated.View>
      </View>

      {/* Category → channel tree */}
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.tree}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={styles.treeHead}>
          <Row
            onPress={() => setTreeOpen((v) => !v)}
            onLongPress={canEditStructure ? () => setStructureMenu({ kind: 'workspace' }) : undefined}
            style={{ flex: 1 }}>
            <Text font="outfit" weight="bold" style={{ flex: 1 }}>
              {NODE_LABELS.workspace}
            </Text>
          </Row>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={treeOpen ? `Collapse ${NODE_LABELS.levelPlural}` : `Expand ${NODE_LABELS.levelPlural}`}
            hitSlop={6}
            style={styles.chevron}
            onPress={() => setTreeOpen((v) => !v)}>
            <RotatingChevron open={treeOpen} />
          </Pressable>
        </View>

        {error ? (
          <Text size="xs" color={dark ? Tone.red400 : Tone.red600} style={styles.error}>
            {error}
          </Text>
        ) : null}

        {treeOpen && depts.length === 0 && !addingLevel ? (
          <EmptyState compact icon={faLayerGroup} title={`No ${NODE_LABELS.levelPlural.toLowerCase()} yet.`} />
        ) : null}

        {treeOpen ? (
          <Animated.View entering={revealIn} exiting={revealOut}>
            {depts.map((d) => {
              const open = expanded.has(d.id);
              const levelLists = listsByDept.get(d.id) ?? [];
              return (
                <Animated.View key={d.id} layout={listLayout}>
                  {/* A category only groups channels: it expands and collapses, it isn't a destination. */}
                  <View style={styles.levelRow}>
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
                        style={({ pressed }) => [
                          styles.levelMain,
                          { backgroundColor: pressed ? theme.surfaceHover : 'transparent' },
                          stateTransition,
                        ]}
                        onPress={() => toggle(d.id)}
                        onLongPress={
                          canEditStructure ? () => setStructureMenu({ kind: 'level', deptId: d.id, name: d.name }) : undefined
                        }>
                        <Text font="outfit" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
                          {d.name}
                        </Text>
                      </PressableScale>
                    )}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={open ? `Collapse ${d.name}` : `Expand ${d.name}`}
                      hitSlop={6}
                      style={styles.chevron}
                      onPress={() => toggle(d.id)}>
                      <RotatingChevron open={open} />
                    </Pressable>
                  </View>

                  {open ? (
                    <Animated.View entering={revealIn} exiting={revealOut} style={styles.lists}>
                      {levelLists.length === 0 && addListFor !== d.id ? (
                        <EmptyState compact icon={faListUl} title={`No ${NODE_LABELS.listPlural.toLowerCase()} yet`} />
                      ) : (
                        levelLists.map((l) => {
                          const listActive = onBoard && scope.listId === l.id;
                          const hasUnread = !listActive && (latestActivityByListId.get(l.id) ?? 0) > (listLastSeen[l.id] ?? 0);
                          if (renamingListId === l.id) {
                            return (
                              <InlineNameInput
                                key={l.id}
                                placeholder={`Name your ${NODE_LABELS.list.toLowerCase()}`}
                                initialValue={l.name}
                                busy={renameList.isPending}
                                onSubmit={(name) => renameChannel(l.id, name)}
                                onCancel={() => setRenamingListId(null)}
                              />
                            );
                          }
                          return (
                            <View key={l.id} style={styles.listRowWrap}>
                              {hasUnread ? <View pointerEvents="none" style={[styles.unreadPill, { backgroundColor: theme.fg }]} /> : null}
                              <Row
                                active={listActive}
                                onPress={() => {
                                  setList(l.id);
                                  markListSeen(l.id);
                                  go('/work');
                                }}
                                onLongPress={
                                  canEditStructure
                                    ? () => setStructureMenu({ kind: 'list', listId: l.id, deptId: d.id, name: l.name })
                                    : undefined
                                }>
                                <Text font="outfit" weight="medium" color="muted">
                                  #{' '}
                                </Text>
                                <Text
                                  font="outfit"
                                  weight={hasUnread ? 'bold' : listActive ? 'semibold' : 'medium'}
                                  color={hasUnread || listActive ? 'fg' : 'muted'}
                                  numberOfLines={1}
                                  style={{ flex: 1 }}>
                                  {l.name}
                                </Text>
                              </Row>
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
            })}
          </Animated.View>
        ) : null}

        {treeOpen && addingLevel ? (
          <InlineNameInput
            placeholder={`Name your ${NODE_LABELS.level.toLowerCase()}`}
            busy={createDept.isPending}
            onSubmit={addLevel}
            onCancel={() => setAddingLevel(false)}
          />
        ) : null}

        <Animated.View layout={listLayout} style={[styles.footer, { borderTopColor: theme.borderSubtle }]}>
          {footer.map((item) => (
            <Row key={item.label} active={item.active} onPress={() => go(item.href)}>
              <Text font="outfit" weight="medium" numberOfLines={1}>
                {item.label}
              </Text>
            </Row>
          ))}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  head: { padding: 8, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  switcher: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 8, borderRadius: Radius.md },
  picker: { marginTop: 8, padding: 4, borderRadius: Radius.xl, borderWidth: StyleSheet.hairlineWidth * 2, gap: 2 },
  primary: { marginTop: 8, paddingHorizontal: 4, gap: 2 },
  pill: { position: 'absolute', top: 0, left: 4, right: 4, borderRadius: Radius.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 8, borderRadius: Radius.md },
  tree: { padding: 8, paddingBottom: 16 },
  treeHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  levelRow: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.md },
  levelMain: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6, borderRadius: Radius.md },
  chevron: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  lists: { marginBottom: 2 },
  listRowWrap: { position: 'relative' },
  /** Discord-style unread indicator: a half-pill sitting just outside the row's left edge. */
  unreadPill: {
    position: 'absolute',
    left: -8,
    top: '50%',
    marginTop: -4,
    width: 4,
    height: 8,
    borderTopRightRadius: Radius.full,
    borderBottomRightRadius: Radius.full,
  },
  inlineWrap: { paddingVertical: 4, paddingHorizontal: 4 },
  inline: { height: 36, borderRadius: Radius.lg, borderWidth: 1, paddingHorizontal: 10, paddingRight: 34, fontSize: 14 },
  inlineSpinner: { position: 'absolute', right: 14, top: 0, bottom: 0 },
  error: { paddingHorizontal: 8, paddingBottom: 6 },
  footer: { marginTop: 8, paddingTop: 4, borderTopWidth: StyleSheet.hairlineWidth * 2, gap: 2 },
});
