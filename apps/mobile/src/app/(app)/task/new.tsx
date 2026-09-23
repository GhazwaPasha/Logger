import { faAnglesDown, faAnglesUp, faArrowUp, faXmark } from '@fortawesome/free-solid-svg-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/motion/pressable-scale';
import { Icon } from '@/components/icon';
import { MenuSheet } from '@/components/menu-sheet';
import { PageEnter, SectionLabel } from '@/components/page';
import { Text } from '@/components/text';
import { Button, Chip, ErrorBanner, Input } from '@/components/ui';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { NODE_LABELS } from '@/lib/labels';
import { useCreateTask } from '@/lib/queries';
import { PRIORITIES, PRIORITY_LABELS, priorityColor, type TaskPriority } from '@/lib/task-board';
import { useWorkspace } from '@/lib/workspace';

const PRIORITY_ICON = { high: faAnglesUp, medium: faArrowUp, low: faAnglesDown } as const;

/** Create a task in a channel (the web's `work/task/new` editor, trimmed to the essentials). */
export default function NewTaskScreenRoute() {
  return (
    <PageEnter>
      <NewTaskScreen />
    </PageEnter>
  );
}

function NewTaskScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const dark = useIsDark();
  const { listId: presetListId } = useLocalSearchParams<{ listId?: string }>();
  const { org, depts, lists, scope, userId } = useWorkspace();
  const create = useCreateTask(org?.id);

  const [title, setTitle] = useState('');
  const [listId, setListId] = useState<string | null>(presetListId ?? null);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [assignToMe, setAssignToMe] = useState(true);
  const [listOpen, setListOpen] = useState(false);

  /** Channels grouped by category order, labelled "Category · Channel". */
  const options = useMemo(() => {
    const deptById = new Map(depts.map((d) => [d.id, d]));
    return [...lists]
      .sort(
        (a, b) =>
          (deptById.get(a.departmentId)?.orderIndex ?? 0) - (deptById.get(b.departmentId)?.orderIndex ?? 0) ||
          a.orderIndex - b.orderIndex,
      )
      .map((l) => ({ value: l.id, label: `${deptById.get(l.departmentId)?.name ?? '—'} · ${l.name}` }));
  }, [depts, lists]);

  const selectedId = listId ?? scope.listId ?? options.find((o) => lists.find((l) => l.id === o.value)?.departmentId === scope.levelId)?.value ?? options[0]?.value ?? null;
  const selected = options.find((o) => o.value === selectedId);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/dashboard'));

  function submit() {
    if (!selectedId || !title.trim()) return;
    create.mutate(
      {
        title: title.trim(),
        listId: selectedId,
        priority,
        assigneeUserIds: assignToMe && userId ? [userId] : [],
      },
      { onSuccess: (res) => router.replace({ pathname: '/task/[id]', params: { id: res.task.id } }) },
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: theme.surfaceBase }]}>
      <View style={[styles.topBar, { borderBottomColor: theme.borderSubtle, paddingTop: insets.top + 6 }]}>
        <Text size="sm" weight="semibold" style={{ flex: 1 }}>
          New task
        </Text>
        <PressableScale scaleTo={0.985} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} onPress={close} style={styles.close}>
          <Icon icon={faXmark} size={16} color="muted" />
        </PressableScale>
      </View>

      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Input placeholder="What needs doing?" value={title} onChangeText={setTitle} autoFocus maxLength={512} />

          <View style={styles.group}>
            <SectionLabel size="10">{NODE_LABELS.list}</SectionLabel>
            {options.length === 0 ? (
              <ErrorBanner message={`This workspace has no ${NODE_LABELS.listPlural.toLowerCase()} yet. Create one on the web app first.`} />
            ) : (
              <PressableScale scaleTo={0.985}
                accessibilityRole="button"
                onPress={() => setListOpen(true)}
                style={[styles.select, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <Text size="sm" numberOfLines={1}>
                  {selected?.label ?? 'Choose…'}
                </Text>
              </PressableScale>
            )}
          </View>

          <View style={styles.group}>
            <SectionLabel size="10">Priority</SectionLabel>
            <View style={styles.chips}>
              {PRIORITIES.map((p) => (
                <Chip
                  key={p}
                  label={PRIORITY_LABELS[p]}
                  selected={p === priority}
                  icon={PRIORITY_ICON[p]}
                  iconColor={priorityColor(p, dark, theme)}
                  onPress={() => setPriority(p)}
                />
              ))}
            </View>
          </View>

          <View style={styles.chips}>
            <Chip label="Assign to me" selected={assignToMe} onPress={() => setAssignToMe((v) => !v)} />
          </View>

          {create.error ? <ErrorBanner message={create.error.message} /> : null}

          <Button
            title="Create task"
            onPress={submit}
            loading={create.isPending}
            disabled={!title.trim() || !selectedId}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <MenuSheet<string>
        visible={listOpen}
        title={NODE_LABELS.list}
        value={selectedId ?? undefined}
        options={options}
        onSelect={setListId}
        onClose={() => setListOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 12, gap: 16 },
  group: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  select: { minHeight: 44, borderRadius: 8, borderWidth: 1, paddingHorizontal: 14, justifyContent: 'center' },
});
