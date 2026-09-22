import { faLayerGroup, faListUl, faPlus } from '@fortawesome/free-solid-svg-icons';
import { router, usePathname, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
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
import { useActiveTasks, useCreateDepartment, useCreateList } from '@/lib/queries';
import { useWorkspace } from '@/lib/workspace';

/** A pressable sidebar row (`rowBase` in `WorkspaceSidebar.tsx`): 4px radius, accent-muted when active. */
function Row({
  active,
  onPress,
  children,
  style,
}: {
  active?: boolean;
  onPress?: () => void;
  children: React.ReactNode;
  style?: object;
}) {
  const theme = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      onPress={onPress}
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

/** The small "+" beside a tree row (`PlusIcon` button on the web). */
function PlusButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      scaleTo={0.9}
      haptic="tap"
      style={({ pressed }) => [styles.plus, { backgroundColor: pressed ? theme.accentMuted : 'transparent' }, stateTransition]}>
      <Icon icon={faPlus} size={13} color="muted" />
    </PressableScale>
  );
}

/**
 * Inline "name your category / channel" field. Enter creates; leaving it with text creates too; leaving it
 * empty cancels — the same flow as the web sidebar.
 */
function InlineNameInput({
  placeholder,
  busy,
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  busy: boolean;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const [value, setValue] = useState('');
  const submitted = useRef(false);

  // After a failed create the field stays mounted; let the user retry.
  useEffect(() => {
    if (!busy) submitted.current = false;
  }, [busy]);

  const submit = () => {
    const name = value.trim();
    if (!name || busy || submitted.current) return;
    submitted.current = true;
    onSubmit(name);
  };

  return (
    <Animated.View entering={revealIn} exiting={revealOut} style={styles.inlineWrap}>
      <TextInput
        autoFocus
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

  /** Only workspace owners may create categories / channels (mirrors the API). */
  const canEditStructure = isWorkspaceOwner(members, userId);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [treeOpen, setTreeOpen] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addingLevel, setAddingLevel] = useState(false);
  const [addListFor, setAddListFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const countByList = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of active.data ?? []) m.set(t.listId, (m.get(t.listId) ?? 0) + 1);
    return m;
  }, [active.data]);

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
          <Row onPress={() => setTreeOpen((v) => !v)} style={{ flex: 1 }}>
            <Text font="outfit" weight="bold" style={{ flex: 1 }}>
              {NODE_LABELS.workspace}
            </Text>
          </Row>
          {canEditStructure ? (
            <PlusButton
              label={`Add ${NODE_LABELS.level}`}
              onPress={() => {
                setTreeOpen(true);
                setAddingLevel(true);
              }}
            />
          ) : null}
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
                      onPress={() => toggle(d.id)}>
                      <Text font="outfit" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
                        {d.name}
                      </Text>
                    </PressableScale>
                    {canEditStructure ? (
                      <PlusButton
                        label={`Add ${NODE_LABELS.list} to ${d.name}`}
                        onPress={() => {
                          setExpanded((prev) => new Set(prev).add(d.id));
                          setAddListFor(d.id);
                        }}
                      />
                    ) : null}
                    <Text font="outfit" weight="semibold" color="muted" tabular style={styles.count}>
                      {levelLists.length}
                    </Text>
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
                    <Animated.View entering={revealIn} exiting={revealOut} style={[styles.lists, { borderLeftColor: theme.borderSubtle }]}>
                      {levelLists.length === 0 && addListFor !== d.id ? (
                        <EmptyState compact icon={faListUl} title={`No ${NODE_LABELS.listPlural.toLowerCase()} yet`} />
                      ) : (
                        levelLists.map((l) => {
                          const listActive = onBoard && scope.listId === l.id;
                          return (
                            <Row
                              key={l.id}
                              active={listActive}
                              onPress={() => {
                                setList(l.id);
                                go('/work');
                              }}>
                              <Text font="outfit" weight="medium" color="muted">
                                #{' '}
                              </Text>
                              <Text
                                font="outfit"
                                weight={listActive ? 'semibold' : 'medium'}
                                color={listActive ? 'fg' : 'muted'}
                                numberOfLines={1}
                                style={{ flex: 1 }}>
                                {l.name}
                              </Text>
                              <Text font="outfit" weight="semibold" color="muted" tabular>
                                {countByList.get(l.id) ?? 0}
                              </Text>
                            </Row>
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
  plus: { width: 28, height: 28, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  count: { paddingHorizontal: 6 },
  chevron: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  lists: { marginLeft: 12, paddingLeft: 4, borderLeftWidth: StyleSheet.hairlineWidth * 2, marginBottom: 2 },
  inlineWrap: { paddingVertical: 4, paddingHorizontal: 4 },
  inline: { height: 36, borderRadius: Radius.lg, borderWidth: 1, paddingHorizontal: 10, paddingRight: 34, fontSize: 14 },
  inlineSpinner: { position: 'absolute', right: 14, top: 0, bottom: 0 },
  error: { paddingHorizontal: 8, paddingBottom: 6 },
  footer: { marginTop: 8, paddingTop: 4, borderTopWidth: StyleSheet.hairlineWidth * 2, gap: 2 },
});
